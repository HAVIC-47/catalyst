# Catalyst — Mood & Money

Correlate daily cash flow against daily mood for predictive personal analytics. Sleek, moody, "Main Character" dark aesthetic — glassmorphism over obsidian, neon cyan + purple data viz.

## Stack

Next.js 14 (App Router, TS) · Tailwind · Recharts · Framer Motion · lucide-react · IndexedDB (idb) · date-fns

Multi-user: email + password auth via **Supabase**, data in **Supabase Postgres** (row-level-secured per user). Currency is **Taka (৳)**; moods are 5 emojis.

## Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com). New project → pick a region → wait for it to provision.
2. **SQL** → New query → paste [db/supabase.sql](db/supabase.sql) → Run. Creates the `entries` table + RLS policies.
3. **Project Settings → API** → copy the **Project URL** and **anon public** key.
4. Copy `.env.local.example` → `.env.local` and paste both values.
5. (Optional, for instant signup in testing) **Authentication → Providers → Email** → turn **Confirm email** OFF. Otherwise new users must click a confirmation link before logging in.

## Run

```bash
npm install
npm run dev      # http://localhost:3000  → redirects to /login
```

Sign up with email + password, then quick-log: press **Ctrl/⌘ + K** anywhere (amount → mood → impulse toggle → optional tags → Enter).

```bash
npm run build    # production build (Vercel-ready)
```

## Deploy (Vercel)

```bash
npm i -g vercel
vercel           # link project
# add the two NEXT_PUBLIC_SUPABASE_* env vars in the Vercel dashboard (or `vercel env add`)
vercel --prod
```

Anyone can then sign up with email at your `*.vercel.app` URL; each user gets private, synced data across devices.

## Features (MVP)

- **Frictionless dual-entry** — Ctrl+K palette logs a transaction + mood in under 3 actions
- **Impulse vs Intentional** toggle + contextual tags (Sleep, Workload, …)
- **Main Character dashboard** — KPI tiles, dual-axis cash-flow×mood trend (7/30/90d), Pearson correlation read-out
- **Color-blocked calendar heatmap** — problem days (high spend + low mood) glow hot
- **Category × mood-band matrix** — which moods drive which spending

## Architecture

- **Auth.** Supabase Auth (email+password), cookie sessions via `@supabase/ssr`. [src/middleware.ts](src/middleware.ts) refreshes the session and guards routes — unauthenticated → `/login`.
- **Data.** Supabase Postgres `entries` table ([db/supabase.sql](db/supabase.sql)), one row per logged entry, RLS-scoped to `auth.uid()`. Data layer: [src/lib/store.ts](src/lib/store.ts) (Supabase queries; same function signatures as before).
- **Routes.** `(auth)` group = `/login`, `/signup`. `(app)` group = the guarded dashboard at `/`.
- Analytics math is client-side: [src/lib/analytics.ts](src/lib/analytics.ts), [src/lib/math.ts](src/lib/math.ts).
- [db/schema.sql](db/schema.sql) is the fuller normalized reference design (transactions / mood_logs / tags); the app uses the simpler denormalized `entries` table in [db/supabase.sql](db/supabase.sql).

## Deferred (next pass)

Villain Arc strict-mode alerts, emotional-friction modals, buyer's-remorse retrospective prompts, predictive sentiment modeling, real auth.
