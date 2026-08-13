// Pages front door (copied into dist/ at deploy time by `npm run cf:deploy`).
// The frontend lives on Pages for the clean URL (palletforge.pages.dev);
// every /api/* call is handed to the palletforge Worker (the backend) via the
// service binding `API` configured on the Pages project. Everything else is
// static assets with SPA fallback.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return env.API.fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
