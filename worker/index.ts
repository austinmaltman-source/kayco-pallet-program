// PalletForge Worker: serves the built SPA (via the assets binding) and the
// /api/* routes. Two jobs:
//   1. /api/state[/:key] - shared app state on D1, one JSON blob per store
//      key, last write wins. This is what makes data shared across
//      devices/roles instead of trapped in one browser's localStorage.
//   2. /api/kayco/* - read-only proxy to the Kayco Sales Intelligence API so
//      the bearer key (KAYCO_API_KEY secret) never reaches the client bundle.
//
// Single-tenant internal tool by design: no auth, matching the app itself.

// Keep in sync with SYNCED_KEYS in src/lib/state-sync.ts.
const STATE_KEYS = new Set([
  'palletforge-products',
  'palletforge-retailers',
  'palletforge-seasons',
  'palletforge-salespeople',
  'palletforge-inventory',
  'palletforge-pallets',
  'palletforge-app-settings',
])

// D1 caps rows around 2 MB; leave headroom.
const MAX_VALUE_BYTES = 1_500_000

const KAYCO_UPSTREAM =
  'https://kayco-planning-dashboard.clondinski1234.workers.dev/api/v1'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface StateRow {
  key: string
  value: string
  updated_at: number
}

async function handleState(request: Request, env: Env, key?: string): Promise<Response> {
  if (!key) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const { results } = await env.DB.prepare(
      'SELECT key, value, updated_at FROM app_state',
    ).all<StateRow>()
    const data: Record<string, { value: string; updatedAt: number }> = {}
    for (const row of results) {
      data[row.key] = { value: row.value, updatedAt: row.updated_at }
    }
    return json({ data })
  }

  if (!STATE_KEYS.has(key)) return json({ error: `Unknown state key: ${key}` }, 404)

  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT value, updated_at FROM app_state WHERE key = ?',
    )
      .bind(key)
      .first<Pick<StateRow, 'value' | 'updated_at'>>()
    return json({
      data: row ? { value: row.value, updatedAt: row.updated_at } : null,
    })
  }

  if (request.method === 'PUT') {
    const body = (await request.json().catch(() => null)) as { value?: unknown } | null
    if (!body || typeof body.value !== 'string') {
      return json({ error: 'Body must be {"value": "<json string>"}' }, 400)
    }
    if (body.value.length > MAX_VALUE_BYTES) {
      return json({ error: 'Payload too large' }, 413)
    }
    // Large payloads arrive gzipped+base64 with a "gz:" prefix (see
    // deflateValue in src/lib/state-sync.ts); plain values must be JSON.
    if (!body.value.startsWith('gz:')) {
      try {
        JSON.parse(body.value)
      } catch {
        return json({ error: 'value must be valid JSON' }, 400)
      }
    }
    const updatedAt = Date.now()
    await env.DB.prepare(
      `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
      .bind(key, body.value, updatedAt)
      .run()
    return json({ data: { updatedAt } })
  }

  return json({ error: 'Method not allowed' }, 405)
}

async function handleKaycoProxy(request: Request, env: Env, path: string): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  if (!env.KAYCO_API_KEY) return json({ error: 'KAYCO_API_KEY is not configured' }, 500)
  const url = new URL(request.url)
  const upstream = await fetch(`${KAYCO_UPSTREAM}${path}${url.search}`, {
    headers: {
      Authorization: `Bearer ${env.KAYCO_API_KEY}`,
      // Upstream Cloudflare Worker 403s bare server-side user agents.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PalletForge/1.0',
    },
  })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'private, max-age=600',
    },
  })
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/state') {
        return await handleState(request, env)
      }
      const stateMatch = url.pathname.match(/^\/api\/state\/([\w.-]+)$/)
      if (stateMatch) {
        return await handleState(request, env, stateMatch[1])
      }
      if (url.pathname.startsWith('/api/kayco/')) {
        return await handleKaycoProxy(request, env, url.pathname.slice('/api/kayco'.length))
      }
      if (url.pathname.startsWith('/api/')) {
        return json({ error: 'Not found' }, 404)
      }
      // run_worker_first only routes /api/* here, but fall through safely.
      return await env.ASSETS.fetch(request)
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'unhandled worker error',
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
      return json({ error: 'Internal error' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
