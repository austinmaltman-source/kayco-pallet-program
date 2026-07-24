// Read-only proxy to the Kayco Sales Intelligence API. Exists so the bearer
// key lives in a Vercel env var (KAYCO_API_KEY) instead of the client bundle.
// In dev, vite.config.ts proxies /api/kayco the same way.
export const config = { runtime: 'edge' }

const UPSTREAM_BASE =
  'https://kayco-planning-dashboard.clondinski1234.workers.dev/api/v1'

declare const process: { env: Record<string, string | undefined> }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }
  const key = process.env.KAYCO_API_KEY
  if (!key) {
    return new Response(
      JSON.stringify({ error: 'KAYCO_API_KEY is not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/kayco/, '')
  const upstream = await fetch(`${UPSTREAM_BASE}${path}${url.search}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      // Upstream Cloudflare Worker 403s bare server-side user agents.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PalletForge/1.0',
    },
  })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type':
        upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'private, max-age=600',
    },
  })
}
