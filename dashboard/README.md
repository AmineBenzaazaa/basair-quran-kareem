# Tafsir Dashboard

Supabase-backed admin dashboard for `TafsirAPP`.

## What It Does

- Creates a standalone Next.js dashboard in `/dashboard`
- Lets you browse and edit the main content modules that drive the app
- Reads and writes `public.content_modules` in Supabase
- Supports optional write-token protection and optional Basic Auth

## Local Run

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL` (optional if `SUPABASE_URL` is present)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended, and used by the dashboard server when present)
- `DASHBOARD_WRITE_TOKEN` (optional, recommended)
- `DASHBOARD_BASIC_AUTH_USER` (optional, recommended)
- `DASHBOARD_BASIC_AUTH_PASSWORD` (optional, recommended)

`SUPABASE_SERVICE_ROLE_KEY` is required for saves from the dashboard server.

## Database Setup

From the repo root:

```bash
npx supabase db push
npm run supabase:content:push
```

The first command applies the schema and Realtime migration. The second seeds every module row into `content_modules`.

## Deployment

For Vercel:
- Root Directory: `dashboard`
- Framework Preset: `Next.js`

Add the same environment variables in the Vercel project before the first deploy.
# basair-quran-kareem
