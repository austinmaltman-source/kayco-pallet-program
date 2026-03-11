# Kayco Pallet Program

## Overview
TBD - awaiting project details.

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Neon Postgres (via Vercel integration) + Drizzle ORM
- Better Auth
- React Query for data fetching
- Framer Motion for animations

## Hosting
- **App:** Vercel
- **Database:** Neon Postgres (Vercel integration)

## Deploy
```bash
# Dev
npm run dev

# Build
npm run build

# Deploy (via Vercel CLI or git push)
vercel
```

## Environment Variables
See `.env.local.example` for required variables.

## Project Structure
```
app/                    # Next.js App Router pages + API routes
├── api/               # Backend API routes
components/            # Shared UI components
db/                    # Database connection + Drizzle schema
lib/                   # Utilities
types/                 # TypeScript type definitions
drizzle/               # Database migration files
```

## External Services
- Neon Postgres via Vercel integration
- Vercel deployment
