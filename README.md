# Catalyst — Mood & Money

Correlate daily cash flow against daily mood for predictive personal analytics. Sleek, moody, "Main Character" dark aesthetic — glassmorphism over obsidian, neon cyan + purple data viz.

## Stack

Next.js 16 (App Router, TS) · React 19 · Tailwind CSS 4 · Recharts · Framer Motion · GSAP · lucide-react · date-fns

Multi-user: email + password (or Google) auth via **Supabase**, data in **Supabase Postgres** (row-level-secured per user). Currency is **Taka (৳)** unless changed in Settings; moods are 5 levels, each with its own icon. The interface is in **English or বাংলা** (Settings → Language — shared with the Android app).

## Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com). New project → pick a region → wait for it to provision.
2. **SQL** → New query → paste [db/supabase.sql](db/supabase.sql) → Run. Creates the tables + row-level-security policies.
   Then run [db/keepalive.sql](db/keepalive.sql) (keeps a free project from pausing) and [db/security.sql](db/security.sql) (locks down anything left without RLS, removes anonymous table access, adds size limits). All three are safe to re-run.
   **Updating an existing project?** Run `db/supabase.sql` and then `db/security.sql` again — they add what's new without touching existing data: wallets and transfers, dhar (`debts`, `debt_payments`), the bill ↔ expense link (`bills.category_id`, `wallet_id`, `last_paid_txn`), `transactions.wallet_id`, browser reminders (`push_subscriptions`), the AI monthly recap, and (1.5) recurring entries (`recurring`, `transactions.recurring_id` / `recurring_on` with one entry per rule and date) and `challenges`. Until they're run, the web and the app keep working without wallets, dhar, recurring entries and challenges.
3. **Project Settings → API** → copy the **Project URL** and **anon public** key.
4. Copy `.env.local.example` → `.env.local` and paste both values, plus a Gemini API key as `GEMINI_API_KEY` for the memo scanner and the AI summaries ([Google AI Studio](https://aistudio.google.com/apikey)). It is read only on the server — never prefix it with `NEXT_PUBLIC_`.
5. **Authentication → Providers → Email**: keep **Confirm email** ON for a public deployment (new users click a link before their first login), and set the minimum password length to 8. **Authentication → URL Configuration**: set the Site URL to your deployed URL so confirmation links land on it, and add these **Redirect URLs**: `https://YOUR-SITE/auth/callback`, `https://YOUR-SITE/auth/confirm` (password resets and Google sign-in on the web) and `com.havic47.catalyst://login-callback` (the same from the Android app).
6. *Optional — Google sign-in.* **Authentication → Providers → Google**: turn it on with a Google OAuth client ID and secret (Google Cloud Console → APIs & Services → Credentials → OAuth client, type *Web application*, authorized redirect URI = the callback URL Supabase shows). Then set `NEXT_PUBLIC_GOOGLE_SIGN_IN=on` for the site and `"GOOGLE_SIGN_IN": "on"` in the app's `env.json`.
7. *Optional — reset links that work on any device.* By default a password-reset link must be opened in the browser (or app) that asked for it. To make it work anywhere, edit **Authentication → Email Templates → Reset password** so the link is `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset`.
8. *Optional — server features.* `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API; server-only) enables **Delete account** and the reminders job. For browser notifications also set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (make a pair once with `npx web-push generate-vapid-keys`) and a long random `CRON_SECRET`, and add the same `CRON_SECRET` as a GitHub Actions secret: [.github/workflows/reminders.yml](.github/workflows/reminders.yml) calls the job hourly and it sends each user one evening push at their own check-in time.

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
# in the Vercel dashboard (or `vercel env add`) — plus, for the optional features,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
# CRON_SECRET and NEXT_PUBLIC_GOOGLE_SIGN_IN=on
vercel --prod
```

Anyone can then sign up with email at your `*.vercel.app` URL; each user gets private, synced data across devices.

## Features (MVP)

- **Frictionless dual-entry** — Ctrl+K palette logs a transaction + mood in under 3 actions
- **Impulse vs Intentional** toggle + contextual tags (Sleep, Workload, …)
- **Main Character dashboard** — KPI tiles, dual-axis cash-flow×mood trend (7/30/90d), Pearson correlation read-out
- **Color-blocked calendar heatmap** — problem days (high spend + low mood) glow hot
- **Category × mood-band matrix** — which moods drive which spending
- **Editable ledger** — the pen on every transaction opens it for editing: type, amount, category, date, time, place and note, or delete it. The ledger, dashboard, calendar, budgets and savings are all computed from the same list, so every total follows the moment you save, and the AI summary cards notice the change.
- **Memo scanner** — the **+** in the middle of the phone's bottom bar (or **Scan memo** on desktop) takes or uploads a photo of a memo/receipt — or a screenshot of notes (Notepad, any notes app, a chat) listing expenses and income. Gemini reads it on the server and you review everything before it's saved: a memo's items (plus VAT / service charge) each become an expense, with any discount shared out; a note's lines become expenses and income, and categories the note names that you don't have yet are created for you (it tells you which). Reads Bengali and English, printed or handwritten. On desktop you can also paste a screenshot (Ctrl+V) or drop an image.
- **List scanner** — on To-do and To buy, the phone's **+** (or **Scan a list** on desktop) takes a screenshot or photo of a list — any notes app, Notepad, a chat, a handwritten list — and every item goes straight onto the board on screen, with its priority, due date and price when the list has them; ticked items land in Done / Bought. **Undo** takes the whole batch back off.
- **To-do and To buy boards** — Jira-style boards with status columns (To do → In progress → Done; To buy → In cart → Bought), numbered tickets with priority, due date, notes and — on to-buy lists — a price, with column totals. Drag tickets within and across columns with the mouse, by touch (press and hold) or from the keyboard (space, arrows, space); move a whole column the same way by its title; rename and add columns. Phone bottom bar: Calendar · Dashboard · **+** · Ledger · More (Journal and the boards live in More).
- **AI summaries and suggestions** — a weekly, monthly or yearly read of the ledger, savings, goals, bills, journal, mood and the to-do and to-buy boards, with suggestions to manage money, save more, feel better or get through the list, on each of those pages (and mood · money · savings on the dashboard). Summaries are saved, so they show instantly on the web and the app; the card says when newer entries exist, and **Refresh** writes a new one. They're written in the app's language and the account's currency.
- **AI monthly recap** — the whole month (or year) in one read on the dashboard — money, savings, mood, bills, wallets and dhar — with what to do differently next time. Early in a month it opens on the month just gone.
- **Bills that log themselves** — tick a bill when you pay it and it's added to the ledger as an expense (its own category, or one named like it, else Utilities), from the wallet it's paid from; a repeating bill moves on to its next due date. Undo takes both back.
- **Recurring income and expenses** — salary on the 1st, rent, subscriptions (`/app/recurring`): name, income or expense, amount, category, wallet and how often — every week or two, twice a month on two days, every month on a day, every 3 months or every year — at a time of day, from a start date (an earlier start fills in the dates since) to an optional end. Each date is added to the ledger by itself, never twice: by the web or the Android app when open, or by the hourly reminders job when neither is, with a notice in the app and a push to browsers that turned notifications on. Pause, edit or delete one any time; entries it already added stay.
- **Wallets** — Cash, bKash, Nagad and Bank to start (rename, add, archive any). Each shows what's in it now; set a starting balance once, and every entry picks the wallet it came from or went to. Transfers move money between wallets without counting as spending — a fee (a bKash cash-out, say) is logged as an expense.
- **Dhar / baki** — money you lent or borrowed, per person: part payments, settle in full, write off, and a reminder the day before it's due back. It moves money in and out of a wallet but never counts as spending or income.
- **Zakat calculator** — `/app/zakat`: wallets and dhar come in by themselves; add cash elsewhere, gold and silver (bhori or grams, at today's price), investments and debts due now, and it shows the nisab (silver or gold) and the 2.5% due — **Log it as paid** adds it to the ledger. The figures are kept with the account (shared with the Android app).
- **Net worth over time** — a dashboard section: what's in the wallets plus dhar owed to you, minus dhar you owe, at the end of each month and today, worked out from the entries.
- **Streaks and challenges** — `/app/challenges`: a streak for every day something is logged by hand, and challenges — no-spend days, spending under an amount, skipping a category, saving an amount, logging every day — for 3 to 30 days, with progress from the entries (automatic ones don't count as spending). Mood & money compares a low day's spending with a good day's, and the **mood-spend alert** says so when a low day comes with 1.5× the usual spending.
- **Notifications** — an evening "how was today?" when no mood is logged, the day before a bill or dhar is due, budget alerts at 80% and 100%, recurring entries added, mood-spend alerts, streak milestones and a streak about to end, and challenges won, missed or on their last day. Shown in the app (reminders bar and notices), as notifications on the phone (Android app) and — if turned on — in the browser. **Settings → Notifications** turns each kind on or off; the web and the app share the settings.
- **Currency** — taka by default; Settings switches how every amount is written (dollar, Canadian dollar, euro, rupee, riyal, ringgit…). Nothing is converted.
- **বাংলা** — the whole app in Bangla: every page, Bengali month names and digits, AI summaries in Bangla. Settings → Language (or the switch on the login page).
- **Account** — change password (Settings → Account: the current one, then the new one), forgot password, optional Google sign-in, and **Delete account**, which removes the account and everything in it.
- **About the app** — Settings → About the app lists everything the web does (the Android app lists its own, with what's new after each update).
- **Settings** — a short list that says how each thing is set: language and currency, notifications, dashboard sections, categories, About the app and the account, each on its own page under `/app/settings` (the sections live in [src/components/settings/](src/components/settings)). Categories has an Expense and an Income page; a new category is added at the top and comes first everywhere.
- **Logo** — the browser-tab icon follows the system's light or dark setting; inside the app the logo follows the site's theme.
- **Privacy Policy and Terms** — public pages at `/privacy` and `/terms` (linked from the landing footer; the Google sign-in consent screen and a Play Store listing point to them too). They cover the website and the Android app.

## Architecture

- **Auth.** Supabase Auth (email+password), cookie sessions via `@supabase/ssr`. [src/proxy.ts](src/proxy.ts) refreshes the session and guards routes — unauthenticated visitors to `/app/*` go to the landing page.
- **Data.** Supabase Postgres tables ([db/supabase.sql](db/supabase.sql)), each RLS-scoped to `auth.uid()`. Data layer: [src/lib/db/](src/lib/db/).
- **Routes.** `/` landing, `(auth)` group = `/login`, `/signup`, and the guarded app under `/app/*`.
- Analytics math is client-side: [src/lib/analytics.ts](src/lib/analytics.ts), [src/lib/math.ts](src/lib/math.ts).
- **Memo and list scanners.** [src/app/api/scan-memo/route.ts](src/app/api/scan-memo/route.ts) and [src/app/api/scan-list/route.ts](src/app/api/scan-list/route.ts) need a signed-in user (session cookie on the web, `Authorization: Bearer <access token>` from the Android app), share a cap of 40 photos per user per day (`memo_scans` table in [db/supabase.sql](db/supabase.sql), via [src/lib/server/scan.ts](src/lib/server/scan.ts)), fall back across Gemini models when one is busy, and return JSON only — the client saves entries, new categories and tickets through the normal RLS-scoped inserts. The Gemini key never leaves the server.
- **AI summaries.** [src/app/api/ai-insights/route.ts](src/app/api/ai-insights/route.ts) takes only a topic and a period — the client never sends text to the model. The server reads that user's rows (RLS-scoped, same sign-in as the memo scanner) and [src/lib/server/insights.ts](src/lib/server/insights.ts) boils them down to a digest with every amount pre-formatted and every comparison pre-computed, so Gemini only writes. Results are saved in `ai_insights` with a fingerprint of the source rows (that's how the card knows there's newer data), and new summaries are capped at 60 per user per day (`ai_requests`). The Gemini call and its model fallback are shared with the memo scanner ([src/lib/server/gemini.ts](src/lib/server/gemini.ts)).
- **Boards.** `boards` → `board_columns` → `tickets` ([src/lib/db/boards.ts](src/lib/db/boards.ts)). A ticket's order inside its column is a float `sort`, so a drag rewrites one row; drag and drop is [@dnd-kit](https://dndkit.com).
- **Wallets and dhar.** Balances are computed, never stored: [src/lib/money.ts](src/lib/money.ts) adds each wallet's opening balance, its income and expenses, transfers and dhar. Entries without a wallet (older ones) count in the default wallet. Transfers live in their own table, so older app versions never mistake one for spending. Net worth over time ([src/lib/networth.ts](src/lib/networth.ts)) replays the same entries up to each month's end.
- **Recurring entries.** A rule (`recurring`) keeps its schedule, the timezone its time is in and `next_on`, the next date not logged yet. [src/lib/recurring.ts](src/lib/recurring.ts) works out the dates (the Android app has the same rules in Dart, and the reminders job uses this file); whoever runs first — the web, the app or the job — inserts the entry with `recurring_id` + `recurring_on`, and a unique constraint on that pair makes a second insert fail, so nothing is logged twice. Streaks, challenges and the mood-spend alert are computed from the entries ([src/lib/habits.ts](src/lib/habits.ts)); a challenge stores only its settings.
- **Reminders job.** [src/app/api/cron/reminders/route.ts](src/app/api/cron/reminders/route.ts) (Bearer `CRON_SECRET`, service-role key) runs hourly from GitHub Actions. It first logs every recurring date that has come due (in each rule's timezone, for every account) and pushes what it added to that person's browsers; then, for each browser that turned reminders on, at the user's check-in hour in their timezone, it sends one Web Push (VAPID, `web-push`) in the user's language — bills, dhar, a streak about to end, a challenge's last day. Each kind follows the user's notification settings. The Android app schedules its own reminders on the phone.
- **Account.** [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts) finishes Google sign-in and reset links (PKCE), [src/app/auth/confirm/route.ts](src/app/auth/confirm/route.ts) handles `token_hash` links, and [src/app/api/account/delete/route.ts](src/app/api/account/delete/route.ts) deletes the signed-in account with the service-role key (every table cascades from `auth.users`).
- **Bangla UI.** Text goes through `tr("English text")` ([src/lib/i18n.ts](src/lib/i18n.ts)); [src/lib/bn.ts](src/lib/bn.ts) holds the Bangla (shared with the Android app's wording). `npm run check:i18n` lists any text without a translation. Dates use date-fns' Bengali locale and figures Bengali digits; Noto Sans/Serif Bengali load only when Bengali text is on screen.
- **Icons.** [public/icon.svg](public/icon.svg) holds both logos and picks one with `prefers-color-scheme` (Chrome, Edge, Firefox); `favicon.ico` (the light logo) is the fallback and `apple-touch-icon.png` the home-screen icon. [public/brand/](public/brand) has the in-app logos and the reminder notification's icon and badge.
- **Security.** Strict response headers (CSP, HSTS, frame-ancestors none, nosniff, referrer and permissions policies) are set in [next.config.js](next.config.js); database hardening lives in [db/security.sql](db/security.sql).

## Deferred (next pass)

Villain Arc strict-mode alerts, emotional-friction modals, buyer's-remorse retrospective prompts, predictive sentiment modeling, real auth.
