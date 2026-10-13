# Catalyst — Mood & Money

Correlate daily cash flow against daily mood for predictive personal analytics. Sleek, moody, "Main Character" dark aesthetic — glassmorphism over obsidian, neon cyan + purple data viz.

## Stack

Next.js 16 (App Router, TS) · React 19 · Tailwind CSS 4 · Recharts · Framer Motion · GSAP · lucide-react · date-fns

Multi-user: email + password auth via **Supabase**, data in **Supabase Postgres** (row-level-secured per user). Currency is **Taka (৳)**; moods are 5 levels, each with its own icon.

## Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com). New project → pick a region → wait for it to provision.
2. **SQL** → New query → paste [db/supabase.sql](db/supabase.sql) → Run. Creates the tables + row-level-security policies.
   Then run [db/keepalive.sql](db/keepalive.sql) (keeps a free project from pausing) and [db/security.sql](db/security.sql) (locks down anything left without RLS, removes anonymous table access, adds size limits). All three are safe to re-run.
   **Updating an existing project?** Run `db/supabase.sql` and then `db/security.sql` again — they add the boards (`boards`, `board_columns`, `tickets`) and AI-summary (`ai_insights`, `ai_requests`) tables without touching existing data.
3. **Project Settings → API** → copy the **Project URL** and **anon public** key.
4. Copy `.env.local.example` → `.env.local` and paste both values, plus a Gemini API key as `GEMINI_API_KEY` for the memo scanner and the AI summaries ([Google AI Studio](https://aistudio.google.com/apikey)). It is read only on the server — never prefix it with `NEXT_PUBLIC_`.
5. **Authentication → Providers → Email**: keep **Confirm email** ON for a public deployment (new users click a link before their first login), and set the minimum password length to 8. **Authentication → URL Configuration**: set the Site URL to your deployed URL so confirmation links land on it.

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
# add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and GEMINI_API_KEY
# in the Vercel dashboard (or `vercel env add`)
vercel --prod
```

Anyone can then sign up with email at your `*.vercel.app` URL; each user gets private, synced data across devices.

## Features (MVP)

- **Frictionless dual-entry** — Ctrl+K palette logs a transaction + mood in under 3 actions
- **Impulse vs Intentional** toggle + contextual tags (Sleep, Workload, …)
- **Main Character dashboard** — KPI tiles, dual-axis cash-flow×mood trend (7/30/90d), Pearson correlation read-out
- **Color-blocked calendar heatmap** — problem days (high spend + low mood) glow hot
- **Category × mood-band matrix** — which moods drive which spending
- **Memo scanner** — the **+** in the middle of the phone's bottom bar (or **Scan memo** on desktop) takes or uploads a photo of a memo/receipt. Gemini reads it on the server, you review the shop, date and items, and every item (plus VAT / service charge) is added as its own expense, with any discount shared out across them. Reads Bengali and English, printed or handwritten.
- **To-do and To buy boards** — Jira-style boards with status columns (To do → In progress → Done; To buy → In cart → Bought), numbered tickets with priority, due date, notes and — on to-buy lists — a price, with column totals. Drag tickets within and across columns with the mouse, by touch (press and hold) or from the keyboard (space, arrows, space); move a whole column the same way by its title; rename and add columns. Phone bottom bar: Calendar · Dashboard · **+** · Ledger · More (Journal and the boards live in More).
- **AI summaries and suggestions** — a weekly, monthly or yearly read of the ledger, savings, goals, bills, journal and mood, with suggestions to manage money, save more or feel better, on each of those pages (and mood · money · savings on the dashboard). Summaries are saved, so they show instantly on the web and the app; the card says when newer entries exist, and **Refresh** writes a new one.

## Architecture

- **Auth.** Supabase Auth (email+password), cookie sessions via `@supabase/ssr`. [src/proxy.ts](src/proxy.ts) refreshes the session and guards routes — unauthenticated visitors to `/app/*` go to the landing page.
- **Data.** Supabase Postgres tables ([db/supabase.sql](db/supabase.sql)), each RLS-scoped to `auth.uid()`. Data layer: [src/lib/db/](src/lib/db/).
- **Routes.** `/` landing, `(auth)` group = `/login`, `/signup`, and the guarded app under `/app/*`.
- Analytics math is client-side: [src/lib/analytics.ts](src/lib/analytics.ts), [src/lib/math.ts](src/lib/math.ts).
- **Memo scanner.** [src/app/api/scan-memo/route.ts](src/app/api/scan-memo/route.ts) needs a signed-in user (session cookie on the web, `Authorization: Bearer <access token>` from the Android app), caps scans at 40 per user per day (`memo_scans` table in [db/supabase.sql](db/supabase.sql)), falls back across Gemini models when one is busy, and returns JSON only — the client saves the items through the normal RLS-scoped inserts. The Gemini key never leaves the server.
- **AI summaries.** [src/app/api/ai-insights/route.ts](src/app/api/ai-insights/route.ts) takes only a topic and a period — the client never sends text to the model. The server reads that user's rows (RLS-scoped, same sign-in as the memo scanner) and [src/lib/server/insights.ts](src/lib/server/insights.ts) boils them down to a digest with every amount pre-formatted and every comparison pre-computed, so Gemini only writes. Results are saved in `ai_insights` with a fingerprint of the source rows (that's how the card knows there's newer data), and new summaries are capped at 60 per user per day (`ai_requests`). The Gemini call and its model fallback are shared with the memo scanner ([src/lib/server/gemini.ts](src/lib/server/gemini.ts)).
- **Boards.** `boards` → `board_columns` → `tickets` ([src/lib/db/boards.ts](src/lib/db/boards.ts)). A ticket's order inside its column is a float `sort`, so a drag rewrites one row; drag and drop is [@dnd-kit](https://dndkit.com).
- **Security.** Strict response headers (CSP, HSTS, frame-ancestors none, nosniff, referrer and permissions policies) are set in [next.config.js](next.config.js); database hardening lives in [db/security.sql](db/security.sql).

## Deferred (next pass)

Villain Arc strict-mode alerts, emotional-friction modals, buyer's-remorse retrospective prompts, predictive sentiment modeling, real auth.
