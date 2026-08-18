// Nightly sales-history sync for the Range selector - sources ONLY the hosted
// Kayco Sales Intelligence API (the maintained interface over Kayco's Azure
// warehouse). No direct Azure access: when the warehouse schema changes, the
// API owner absorbs it and this sync keeps working.
//
// Flow (per run):
//   1. Read the app's own config: linked customer scope (retailer account
//      patterns + explicit ids) and the item catalog.
//   2. For every catalog item, GET /items/:id/accounts - keep scoped accounts
//      whose lastOrder is within DELTA_DAYS (i.e. something changed).
//   3. For each such (item, account) pair, GET .../transactions and rebuild
//      that pair's complete month-by-month history (cases + net, penny-exact
//      basis verified against the dashboard 2026-08-14).
//   4. Upsert per month into the app backend's /api/sales/ingest.
//
// MODE=incremental (default, DELTA_DAYS lookback) | backfill (every scoped
// pair regardless of recency - slow, only for rebuilding history from zero).
const APP_BASE = "https://kayco-pallet-programs.pages.dev";
const API_BASE =
  "https://kayco-planning-dashboard.clondinski1234.workers.dev/api/v1";
const KAYCO_KEY = process.env.KAYCO_API_KEY;
const TOKEN = process.env.PALLET_INGEST_TOKEN;
const MODE = process.env.MODE || "incremental";
const DELTA_DAYS = Number(process.env.DELTA_DAYS || 8);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);
const CHUNK = 1500;

if (!KAYCO_KEY || !TOKEN) {
  console.error("KAYCO_API_KEY / PALLET_INGEST_TOKEN missing");
  process.exit(1);
}

const kaycoHeaders = {
  Authorization: `Bearer ${KAYCO_KEY}`,
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PalletSync/1.0",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Be a polite API citizen: pace every call, and when the upstream rate
// limiter answers 429, back off for real (it runs a cooldown window - short
// retries just burn attempts, which is how the first backfill died).
async function kayco(path, attempt = 1) {
  const res = await fetch(`${API_BASE}${path}`, { headers: kaycoHeaders });
  if (res.status === 429) {
    if (attempt <= 5) {
      await sleep(30000 * attempt);
      return kayco(path, attempt + 1);
    }
    throw new Error(`${path} -> 429 (gave up after long backoff)`);
  }
  if (!res.ok) {
    if (attempt < 3) {
      await sleep(2000 * attempt);
      return kayco(path, attempt + 1);
    }
    throw new Error(`${path} -> ${res.status}`);
  }
  await sleep(150); // global pacing
  return (await res.json()).data;
}

async function inflateMaybe(value) {
  if (!value.startsWith("gz:")) return value;
  const { gunzipSync } = await import("node:zlib");
  return gunzipSync(Buffer.from(value.slice(3), "base64")).toString("utf8");
}

async function appState(key) {
  const res = await fetch(`${APP_BASE}/api/state/${key}`);
  if (!res.ok) throw new Error(`app state ${key} -> ${res.status}`);
  const body = await res.json();
  if (!body.data?.value) throw new Error(`app state ${key} is empty`);
  return JSON.parse(await inflateMaybe(body.data.value));
}

const normKey = (v) => String(v ?? "").trim().replace(/^0+(?=\d)/, "");

// --- 1. scope + catalog from the app itself --------------------------------
const retailers = await appState("palletforge-retailers");
const patterns = new Set();
const explicitIds = new Set();
for (const r of retailers) {
  for (const p of r.kaycoAccountPatterns ?? []) {
    const t = String(p).trim().toUpperCase();
    if (t) patterns.add(t);
  }
  for (const a of r.kaycoAccounts ?? []) {
    const id = normKey(a.id);
    if (id) explicitIds.add(id);
  }
}
if (patterns.size === 0 && explicitIds.size === 0) {
  throw new Error("customer scope is empty - refusing to sync nothing");
}
const inScope = (accountId, accountName) => {
  const name = String(accountName ?? "").trim().toUpperCase();
  return (
    explicitIds.has(normKey(accountId)) ||
    [...patterns].some((p) => name.startsWith(p))
  );
};

const products = await appState("palletforge-products");
// Only pull what the app can actually show: items AUTHORIZED for (or already
// selected on) some retailer's program - a few hundred - not the whole
// 4,671-item catalog. Newly authorized items appear the next night.
const neededProductIds = new Set();
for (const r of retailers) {
  for (const item of r.authorizedItems ?? []) neededProductIds.add(item.productId);
}
try {
  const pallets = await appState("palletforge-pallets");
  for (const pallet of pallets) {
    for (const id of pallet.selectedProductIds ?? []) neededProductIds.add(id);
    for (const entry of pallet.assortment ?? []) neededProductIds.add(entry.productId);
  }
} catch {
  // no pallets yet - authorized items alone are fine
}
const productById = new Map(products.map((p) => [p.id, p]));
let itemNumbers = [
  ...new Set(
    [...neededProductIds]
      .map((id) => normKey(productById.get(id)?.kaycoItemNumber))
      .filter((n) => /^\d+$/.test(n)),
  ),
];
if (itemNumbers.length === 0) {
  // Safety net: nothing authorized yet -> fall back to the full catalog.
  itemNumbers = [
    ...new Set(
      products.map((p) => normKey(p.kaycoItemNumber)).filter((n) => /^\d+$/.test(n)),
    ),
  ];
}
console.log(
  `scope: ${patterns.size} patterns, ${explicitIds.size} ids | catalog items: ${itemNumbers.length} | mode: ${MODE}`,
);

const cutoff = new Date(Date.now() - DELTA_DAYS * 86400000)
  .toISOString()
  .slice(0, 10);

// --- 2+3. discover active pairs, pull their transactions -------------------
async function mapLimit(list, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < list.length) {
        const idx = i++;
        out[idx] = await fn(list[idx]);
      }
    }),
  );
  return out;
}

let itemErrors = 0;
// monthly upserts: month -> rows [item, account, name, cases, netCents]
const byMonth = new Map();
let pairCount = 0;

const results = await mapLimit(itemNumbers, CONCURRENCY, async (item) => {
  let accounts;
  try {
    accounts = await kayco(`/items/${item}/accounts`);
  } catch (e) {
    itemErrors++;
    if (itemErrors <= 5) console.error(`accounts fetch failed for ${item}: ${e.message}`);
    return;
  }
  if (!Array.isArray(accounts)) return;
  const active = accounts.filter(
    (a) =>
      inScope(a.id, a.name) &&
      (MODE === "backfill" || (a.lastOrder && a.lastOrder >= cutoff)),
  );
  for (const account of active) {
    let tx;
    try {
      tx = await kayco(`/items/${item}/accounts/${account.id}/transactions`);
    } catch (e) {
      itemErrors++;
      continue;
    }
    if (!Array.isArray(tx) || tx.length === 0) continue;
    pairCount++;
    const months = new Map();
    for (const t of tx) {
      const month = String(t.date ?? "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      const m = months.get(month) ?? { cases: 0, net: 0 };
      m.cases += Number(t.casesRaw) || 0;
      m.net += Number(t.netRaw) || 0;
      months.set(month, m);
    }
    for (const [month, sums] of months) {
      const rows = byMonth.get(month) ?? [];
      rows.push([
        item,
        normKey(account.id),
        String(account.name ?? "").trim(),
        sums.cases,
        Math.round(sums.net * 100),
      ]);
      byMonth.set(month, rows);
    }
  }
});
void results;

console.log(
  `active pairs: ${pairCount} | months touched: ${byMonth.size} | item errors: ${itemErrors}`,
);
// Coverage guard (walmart-dashboard pattern): a broken upstream must fail
// loudly, not quietly stamp a "successful" empty sync.
if (itemErrors > itemNumbers.length * 0.2) {
  throw new Error(`too many item failures (${itemErrors}) - aborting`);
}

// --- 4. upsert into the app backend ---------------------------------------
async function post(body, append) {
  const url = `${APP_BASE}/api/sales/ingest${append ? "?append=1" : ""}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    console.error(`ingest ${res.status} (attempt ${attempt}): ${text.slice(0, 200)}`);
    if (attempt === 3) throw new Error(`ingest failed: ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

for (const [month, rows] of [...byMonth.entries()].sort()) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    // Always append/upsert: these are per-pair corrections, never a full
    // month snapshot, so the month must not be wiped first.
    await post({ month, rows: rows.slice(i, i + CHUNK) }, true);
  }
  console.log(`${month}: upserted ${rows.length} pair rows`);
}

if (pairCount > 0 || MODE === "incremental") {
  await post({ syncedAt: new Date().toISOString() });
}
console.log("DONE");
