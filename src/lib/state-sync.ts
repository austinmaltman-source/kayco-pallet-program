// Client half of the shared-state backend (see worker/index.ts).
//
// Model: localStorage stays the fast local cache and offline fallback; the
// Worker's D1 copy is the shared source of truth across devices and roles.
// On startup App.tsx hydrates from the server when reachable (falling back to
// localStorage), then every store write is mirrored to both. Last write wins
// per key. When the server is unreachable (e.g. `npm run dev` without
// `wrangler dev`, or the old Vercel deploy), the app behaves exactly as the
// localStorage-only version did.

export const SYNCED_KEYS = [
  'palletforge-products',
  'palletforge-retailers',
  'palletforge-seasons',
  'palletforge-salespeople',
  'palletforge-inventory',
  'palletforge-pallets',
  'palletforge-app-settings',
] as const

export type SyncedKey = (typeof SYNCED_KEYS)[number]

export interface ServerEntry {
  value: string
  updatedAt: number
}

const PUSH_DEBOUNCE_MS = 1200

let serverOnline = false
// Last payload per key that is known to match the server (either applied
// from it or successfully pushed). Used to skip echo pushes and no-op applies.
const lastSynced = new Map<string, string>()
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingValues = new Map<string, string>()

export function isServerOnline(): boolean {
  return serverOnline
}

// Record that `value` for `key` matches the server without pushing (used when
// applying a server payload into a store, whose subscription then fires).
export function markSynced(key: SyncedKey, value: string): void {
  lastSynced.set(key, value)
}

export async function fetchServerState(
  timeoutMs = 3500,
): Promise<Map<string, ServerEntry> | null> {
  try {
    const res = await fetch('/api/state', {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`GET /api/state ${res.status}`)
    const body = (await res.json()) as {
      data?: Record<string, ServerEntry>
    }
    if (!body || typeof body.data !== 'object' || body.data === null) {
      throw new Error('Malformed /api/state response')
    }
    serverOnline = true
    const entries = new Map<string, ServerEntry>()
    for (const [key, entry] of Object.entries(body.data)) {
      if (entry && typeof entry.value === 'string') entries.set(key, entry)
    }
    return entries
  } catch {
    serverOnline = false
    return null
  }
}

async function pushNow(key: SyncedKey): Promise<void> {
  const value = pendingValues.get(key)
  if (value === undefined) return
  pendingValues.delete(key)
  try {
    const res = await fetch(`/api/state/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) throw new Error(`PUT ${key} ${res.status}`)
    lastSynced.set(key, value)
  } catch {
    // Keep the value queued so the next write (or flush) retries; the
    // localStorage copy is already safe.
    if (!pendingValues.has(key)) pendingValues.set(key, value)
    serverOnline = false
  }
}

// Mirror a store write to the server, debounced per key. No-op while the
// server is offline or when the payload already matches the server copy.
export function schedulePush(key: SyncedKey, value: string): void {
  if (!serverOnline) return
  if (lastSynced.get(key) === value) return
  pendingValues.set(key, value)
  const existing = pushTimers.get(key)
  if (existing) clearTimeout(existing)
  pushTimers.set(
    key,
    setTimeout(() => {
      pushTimers.delete(key)
      void pushNow(key)
    }, PUSH_DEBOUNCE_MS),
  )
}

// Decide which keys from a server snapshot should be applied locally: the
// payload must differ from what we already know matches the server.
export function selectApplicableEntries(
  entries: Map<string, ServerEntry>,
): Map<SyncedKey, string> {
  const result = new Map<SyncedKey, string>()
  for (const key of SYNCED_KEYS) {
    const entry = entries.get(key)
    if (!entry) continue
    if (lastSynced.get(key) === entry.value) continue
    result.set(key, entry.value)
  }
  return result
}

// Test hook: reset module state between tests.
export function __resetStateSyncForTests(): void {
  serverOnline = false
  lastSynced.clear()
  pendingValues.clear()
  for (const timer of pushTimers.values()) clearTimeout(timer)
  pushTimers.clear()
}
