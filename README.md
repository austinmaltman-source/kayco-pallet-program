# Kayco Pallet Program (PalletForge)

PalletForge is a single-tenant pallet program management app for **Kayco**. Salesmen, buyers, builders, and managers plan holiday pallet programs for retailers - picking items, setting confirm-by deadlines, queuing builds, and rolling up demand.

Vite + React 19 + TypeScript, Tailwind v4, Zustand. No backend, no auth - state persists to `localStorage`, roles are switched via a picker. Deploys to Vercel.

## Run locally

Prereqs: Node 20+.

```bash
npm install
cp .env.example .env.local   # if not already present
# set GEMINI_API_KEY in .env.local for AI features
npm run dev                  # http://localhost:3003
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3003 (`--host 0.0.0.0`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm test` | Vitest one-shot |
| `npm run test:watch` | Vitest watch mode |

## Deploy

Vercel auto-deploys on push to `main` (config in [vercel.json](vercel.json)). Manual deploy: `vercel`.

## Repository layout

- `origin` -> `github.com/austinmaltman-source/kayco-pallet-program` - active, push here
- `clondin` -> `github.com/Clondin/Pallet-Program-New-` - read-only backup of the original codebase, do not push

## Docs

- [PROJECT.md](PROJECT.md) - structure, tech stack, route table, conventions
- [CLAUDE.md](CLAUDE.md) - agent working style + domain quick reference
