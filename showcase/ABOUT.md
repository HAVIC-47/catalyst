# Catalyst — Mood × Money

**An honest ledger that maps every taka against how the day actually felt.**

Live: [catalyst-hishab.vercel.app](https://catalyst-hishab.vercel.app) · Repo: [github.com/HAVIC-47/catalyst](https://github.com/HAVIC-47/catalyst)

---

## 1. What it is

Catalyst is a personal **mood + money** tracker built for Bangladesh (৳ Taka). It logs
daily spending, income, savings, and mood — then shows where they collide.

Most finance apps count money. Catalyst also counts how you *felt* spending it. The point
is to surface the pattern behind impulse spending: the days a low mood quietly drains the
wallet. See it, and you can change it.

It's a multi-user web app — anyone signs up with email, and each user's data is private
(row-level secured). Free to run end-to-end.

### Who it's for
Anyone who wants to understand the *why* behind their spending, not just the *what* — and
who lives in ৳ and thinks in the Bangladeshi calendar of income and expenses.

---

## 2. Core features

| Area | What it does |
|------|--------------|
| **Frictionless entry** | One modal, three tabs — **Money** (expense ⇄ income, both saved in one go), **Mood** (5 emoji + context tags, multiple per day), **Saving** (add to a savings pool). Amount + category + place + time. |
| **Calendar home** | Month / Week / Year views. Each day is tinted by **mood** (red→green) with **spend** (oxblood) and **income** (blue) overlays — problem days glow without reading a number. Tap a day to log for that date. |
| **Dashboard** | KPI tiles (Spent / Earned / Saved / Avg-mood) + **7 charts** driven by one shared Day/Week/Month/Year selector: mood×money overlap (with Pearson *r*), Spent & Earned donuts, Mood distribution, Savings added-vs-broken, mood-tag frequency, category frequency. |
| **Transactions** | Grouped per day with **In / Out / Saved / Net** totals; delete inline. |
| **Vault Mode** | A topbar toggle. When on, every income **adds** to savings and every expense **draws** from it — the savings chart tracks true net-worth flow. |
| **Budgets** | Monthly per-category limits with progress bars; go red when overspent. |
| **Goals** | Savings targets with progress; add contributions. |
| **Bills** | Due-date countdowns, recurrence, mark paid. |
| **Journal** | Daily free-write log + a custom habit/activity tracker (add/remove your own). |
| **Settings** | Full category CRUD (expense + income) — add, rename, recolor, delete; restore defaults. |
| **Themes** | Dark (default, true-black) and light ("bone paper"), toggle persists. |
| **Mobile** | Bottom bar: 3 links · center **Entry** · Journal / Theme / More. The "More" sheet holds the rest. |

---

## 3. How it's made

### Tech stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** — serverless Postgres + email auth, **Row-Level Security** (each row scoped to `auth.uid()`)
- **Recharts** — charts · **Framer Motion** — UI motion · **GSAP** — landing hero animation · **lucide-react** — icons
- **Vercel** — hosting (free Hobby tier), auto-deploy on every `git push`
- **date-fns** — date math · **clsx** + **tailwind-merge** — class helpers

### Design language — "Editorial Almanac"
Deliberately not the generic "AI SaaS" look. It reads like a printed financial diary.

- **Palette** (CSS variables that flip on a `.dark` class):
  - Light: bone paper `#F4F0E8` · ink `#1A1714` · oxblood accent `#9B3A2D`
  - Dark (default): true black `#000` · off-white `#FAFAF6` · clay accent `#E28670`
  - Data tones: forest income · brick expense · ink-blue saving · brick→forest mood scale
- **Type**: Newsreader (editorial serif display) · Hanken Grotesk (body) · IBM Plex Mono (ledger figures)
- **Surfaces**: flat cards, hairline borders, paper grain; dark mode adds atmospheric
  accent glows, lit card corners, and a headline halo.

### Project structure
```
src/
  app/
    page.tsx              landing (hero, features, why, CTA)
    (auth)/               /login, /signup — gated, reachable only from landing
    app/                  guarded app area
      page.tsx            calendar (home)
      dashboard/          KPIs + 7 charts
      transactions/       ledger
      budgets/ goals/ bills/ journal/ settings/
    layout.tsx            fonts + no-flash theme script
    globals.css           theme tokens, .card/.entry-btn, dark atmosphere
  components/
    entry/entry-modal     Money / Mood / Saving tabs
    charts/               overlap, donuts, bars, shared range controls
    layout/               sidebar, topbar, bottom-nav, more-sheet
    landing/              hero (GSAP), features, why, cta
    features/             auth-form, user-menu, vault-mode-toggle
    ui/                   theme-toggle, glass-card, etc.
  hooks/use-app-data      single client store (data + entry modal + Vault Mode)
  lib/
    supabase/             browser + server clients
    db/                   CRUD per table (categories, transactions, moods, …)
    range.ts              shared period-window math
    utils.ts / math.ts    formatting, Pearson correlation
db/
  supabase.sql            schema + RLS (run once in Supabase)
  schema.sql              fuller normalized reference design
```

### Data model (Postgres, RLS on every table)
- `categories` — expense/income, name, color (per user)
- `transactions` — kind (`expense`/`income`/`saving`), amount, category, place, note, `occurred_at`
- `mood_logs` — mood 1–5, note, tags (jsonb), `logged_at`
- `budgets`, `goals`, `bills`, `journal_entries`, `activities`, `activity_logs`

---

## 4. How it works (flow)

1. **Landing → Sign up** (email + password). Middleware guards `/app/*`: no session → landing.
2. On first load the client store (`use-app-data`) fetches everything once and seeds the
   default categories.
3. **Log** via the Entry modal → Supabase insert (RLS auto-scopes to the user) → the store
   updates → calendar, dashboard, and charts recompute live.
4. **Analyse** on the dashboard: one period selector drives all charts; the mood×money
   overlay + Pearson *r* quantify the link between feeling and spending.
5. Data persists in Postgres, synced across devices.

**Vault Mode** and the theme choice are client preferences (localStorage); everything else
lives in the database.

---

## 5. Run it yourself

### Prerequisites
- Node 18+
- A free Supabase project

### Setup
```bash
git clone https://github.com/HAVIC-47/catalyst
cd catalyst
npm install
```

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run [`db/supabase.sql`](db/supabase.sql) (tables + RLS).
3. **Settings → API** → copy the Project URL + anon key.
4. Copy `.env.local.example` → `.env.local` and paste both:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
5. (For instant testing) **Auth → Providers → Email** → turn **Confirm email** off.

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
```

### Deploy (Vercel)
1. Push to GitHub → import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the two `NEXT_PUBLIC_SUPABASE_*` env vars (they're **build-time** — redeploy after any change).
3. Deploy. Anyone can then sign up at your `*.vercel.app` URL.

> **Note:** free Supabase projects pause after ~7 days idle — the hostname stops resolving
> and fetches fail. Restore/resume the project in the Supabase dashboard to bring it back.

---

## 6. Notable engineering details
- **Theme without flash** — `class="dark"` ships in the server-rendered HTML; a tiny inline
  script removes it only if the user chose light. All colours are CSS-variable tokens, so
  one class flips the whole app (charts included, via `rgb(var(--c-ink))` fills).
- **One selector, seven charts** — the dashboard owns `range`/`offset`; the top trend chart's
  controls set it and every chart reads the same window.
- **Resilient loading** — each data collection loads independently, so a missing table
  (e.g. before a migration) degrades gracefully instead of blanking the app.
- **Gated auth** — `/login` and `/signup` are only reachable via landing CTAs (`?from=landing`);
  a direct hit or refresh bounces to the landing page.

---

## 7. Screenshots
See [`showcase/`](showcase/) — 15 captures (landing, calendar, dashboard, entry, transactions,
mobile, both themes) plus `showcase/index.html`, a ready-to-open gallery.

---

*Built with Next.js + Supabase. Editorial Almanac design. ৳ from day one.*
