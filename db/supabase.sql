-- Catalyst v2 — Supabase schema (separate money + mood model, multi-page app).
-- Run in Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Tables: categories, transactions, mood_logs (Phase 1) +
-- budgets, goals, bills, journal_entries, activities, activity_logs (later phases) +
-- memo_scans (daily limit for the memo reader) +
-- boards, board_columns, tickets (to-do and to-buy boards) +
-- ai_insights, ai_requests (saved AI summaries and their daily limit) +
-- wallets, transfers (where money sits and moves between) +
-- debts, debt_payments (dhar / baki) + push_subscriptions (web reminders) +
-- recurring (incomes and expenses that log themselves) + challenges.
-- Every table is Row-Level-Security scoped to auth.uid() so users see only their own data.

create extension if not exists "pgcrypto";

-- Optional: drop the old v1 single-table model. Uncomment if you ran the old schema.
-- drop table if exists public.entries cascade;

-- Helper to keep RLS policy creation idempotent.
do $$ begin perform 1; end $$;

-- CATEGORIES ------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('expense','income')),
  color      text not null default '#A855F7',
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

-- WALLETS (where money sits: cash, bKash, Nagad, a bank account…) ------------
-- A balance is the opening balance plus the entries and transfers in that wallet.
create table if not exists public.wallets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  kind            text not null default 'cash' check (kind in ('cash','mobile','bank','card','other')),
  color           text not null default '#7A746A',
  opening_balance numeric(14,2) not null default 0,
  sort            int  not null default 0,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- TRANSFERS between wallets — their own table, so moving money never counts as
-- spending or income anywhere (and older app versions never see them).
create table if not exists public.transfers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_wallet uuid not null references public.wallets(id) on delete cascade,
  to_wallet   uuid not null references public.wallets(id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  note        text not null default '',
  occurred_on date not null default current_date,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  constraint transfers_two_wallets check (from_wallet <> to_wallet)
);

-- TRANSACTIONS (money) --------------------------------------------------------
-- amount stored positive; `kind` carries the sign meaning.
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('expense','income','saving')),
  amount        numeric(14,2) not null check (amount >= 0),
  category_id   uuid references public.categories(id) on delete set null,
  category_name text not null default 'Other',  -- snapshot, survives category deletion
  place         text not null default '',
  note          text not null default '',
  occurred_on   date not null default current_date,
  occurred_at   timestamptz not null default now(),  -- full timestamp for intraday view
  created_at    timestamptz not null default now()
);
alter table public.transactions add column if not exists occurred_at timestamptz not null default now();
-- Allow a third kind 'saving' (positive contribution to a separate savings pool).
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in ('expense','income','saving'));
-- The wallet an entry came from or went into (null = the default wallet).
alter table public.transactions add column if not exists wallet_id uuid references public.wallets(id) on delete set null;

-- MOOD LOGS (multiple per day, each with a timestamp) -------------------------
create table if not exists public.mood_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mood       smallint not null check (mood between 1 and 5),
  note       text not null default '',
  logged_on  date not null default current_date,
  logged_at  timestamptz not null default now(),  -- time of day for intraday view
  tags       jsonb not null default '[]'::jsonb,  -- context: ["Family time","Travel"...]
  created_at timestamptz not null default now()
);
-- Migrations for existing installs:
alter table public.mood_logs add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.mood_logs add column if not exists logged_at timestamptz not null default now();
-- Allow multiple moods per day (was previously one-per-day):
alter table public.mood_logs drop constraint if exists mood_logs_user_id_logged_on_key;

-- BUDGETS ---------------------------------------------------------------------
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete cascade,
  category_name text not null default 'Overall',
  amount        numeric(14,2) not null check (amount >= 0),
  period        text not null default 'monthly',
  created_at    timestamptz not null default now()
);

-- GOALS -----------------------------------------------------------------------
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null,
  target_amount numeric(14,2) not null check (target_amount >= 0),
  saved_amount  numeric(14,2) not null default 0,
  due_on       date,
  created_at   timestamptz not null default now()
);

-- BILLS -----------------------------------------------------------------------
create table if not exists public.bills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  amount      numeric(14,2) not null check (amount >= 0),
  due_on      date not null,
  recurrence  text not null default 'monthly',
  is_paid     boolean not null default false,
  created_at  timestamptz not null default now()
);
-- Paying a bill logs an expense: under this category, from this wallet. The last
-- one it logged is remembered so "mark unpaid" can take it back off the ledger.
alter table public.bills add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.bills add column if not exists wallet_id uuid references public.wallets(id) on delete set null;
alter table public.bills add column if not exists last_paid_txn uuid references public.transactions(id) on delete set null;

-- RECURRING income and expenses: a salary on the 1st, rent, subscriptions — they
-- log themselves. Every week (or every few), every month (or every few: 3 = a
-- quarter, 12 = a year) on a day, or twice a month on two days, at a time of day
-- in the timezone it was set up in. next_on is the next date not logged yet.
-- Whichever gets there first logs a due date: the web or the app when open, or
-- the hourly reminders job (src/app/api/cron/reminders).
create table if not exists public.recurring (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('expense','income')),
  amount      numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  wallet_id   uuid references public.wallets(id) on delete set null,
  frequency   text not null default 'monthly' check (frequency in ('weekly','monthly','twice_monthly')),
  every       smallint not null default 1 check (every between 1 and 12),
  day1        smallint not null default 1 check (day1 between 1 and 31),  -- weekly: 1 Mon … 7 Sun
  day2        smallint check (day2 between 1 and 31),                     -- twice a month
  at_time     text not null default '09:00',
  start_on    date not null default current_date,
  end_on      date,
  next_on     date not null default current_date,
  paused      boolean not null default false,
  tz          text not null default 'Asia/Dhaka',
  created_at  timestamptz not null default now()
);
-- The entries a rule logged: which rule and which of its dates. One entry per
-- rule and date, so two devices (or a device and the job) can never log it twice.
alter table public.transactions add column if not exists recurring_id uuid references public.recurring(id) on delete set null;
alter table public.transactions add column if not exists recurring_on date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_recurring_once') then
    alter table public.transactions add constraint transactions_recurring_once unique (recurring_id, recurring_on);
  end if;
end $$;

-- CHALLENGES: no-spend days, spending under an amount, skipping a category,
-- saving an amount, or logging every day — for a number of days from a start.
-- Progress comes from the entries themselves; only the settings are stored.
create table if not exists public.challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('no_spend','spend_under','skip_category','save','log_daily')),
  target        numeric(14,2) not null default 0 check (target >= 0),
  category_id   uuid references public.categories(id) on delete set null,
  category_name text not null default '',
  start_on      date not null default current_date,
  days          smallint not null default 7 check (days between 1 and 366),
  created_at    timestamptz not null default now()
);

-- DEBTS (dhar / baki): money you lent (they owe you) or borrowed (you owe them).
-- What's left is the amount minus its payments. None of it counts as spending
-- or income; it only moves money in and out of a wallet.
create table if not exists public.debts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person      text not null,
  direction   text not null check (direction in ('lent','borrowed')),
  amount      numeric(14,2) not null check (amount > 0),
  note        text not null default '',
  wallet_id   uuid references public.wallets(id) on delete set null,
  occurred_on date not null default current_date,
  due_on      date,
  closed      boolean not null default false,  -- settled, or written off
  created_at  timestamptz not null default now()
);
create table if not exists public.debt_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id    uuid not null references public.debts(id) on delete cascade,
  amount     numeric(14,2) not null check (amount > 0),
  wallet_id  uuid references public.wallets(id) on delete set null,
  paid_on    date not null default current_date,
  note       text not null default '',
  created_at timestamptz not null default now()
);

-- JOURNAL (daily experience log) ---------------------------------------------
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_on   date not null default current_date,
  mood       smallint check (mood between 1 and 5),
  title      text not null default '',
  body       text not null default '',
  created_at timestamptz not null default now()
);

-- CUSTOM DAILY-LIFE ACTIVITIES (user add/remove) + their daily logs -----------
create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#22D3EE',
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  logged_on   date not null default current_date,
  value       text not null default 'done',
  created_at  timestamptz not null default now()
);

-- MEMO SCANS (one row per photo read by /api/scan-memo or /api/scan-list) -------
-- Only used to cap how many photos (memos, notes, lists) each account can have
-- read per day with the server's Gemini key. Holds no photo and no content.
create table if not exists public.memo_scans (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- BOARDS (Jira-style to-do and to-buy boards) ---------------------------------
-- A board has ordered columns (statuses). Each ticket sits in one column and is
-- ordered inside it by `sort` — a float, so moving a ticket rewrites one row.
-- Deleting a board removes its columns and tickets; deleting a column removes
-- its tickets (the apps ask first).
create table if not exists public.boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null default 'todo' check (kind in ('todo','shopping')),
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.board_columns (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id   uuid not null references public.boards(id) on delete cascade,
  name       text not null,
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id    uuid not null references public.boards(id) on delete cascade,
  column_id   uuid not null references public.board_columns(id) on delete cascade,
  number      int  not null default 0,                -- per-board ticket number (#12)
  title       text not null,
  description text not null default '',
  priority    text not null default 'medium' check (priority in ('low','medium','high')),
  due_on      date,
  amount      numeric(14,2) check (amount >= 0),      -- price, for to-buy items
  sort        double precision not null default 0,
  created_at  timestamptz not null default now()
);

-- AI INSIGHTS (Gemini summaries + suggestions, /api/ai-insights) ---------------
-- The latest summary per topic and period, so it shows straight away on the web
-- and the app until the user refreshes it. data_hash fingerprints the rows it was
-- written from: a different hash means there's newer data than the summary.
create table if not exists public.ai_insights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic      text not null check (topic in ('journal','ledger','goals','savings','bills','mood','todo','shopping','recap')),
  period     text not null check (period in ('week','month','year')),
  start_on   date not null,
  data_hash  text not null default '',
  content    jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, topic, period, start_on)
);
-- Topics added after the table was first created (boards, the monthly recap).
alter table public.ai_insights drop constraint if exists ai_insights_topic_check;
alter table public.ai_insights add constraint ai_insights_topic_check
  check (topic in ('journal','ledger','goals','savings','bills','mood','todo','shopping','recap'));

-- AI REQUESTS (one row per summary written with the server's Gemini key) -------
-- Like memo_scans: holds no content, only caps summaries per account per day.
create table if not exists public.ai_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic      text not null default '',
  created_at timestamptz not null default now()
);

-- PUSH SUBSCRIPTIONS (web reminders) ------------------------------------------
-- One row per browser that turned reminders on. The reminders job (run by the
-- server with its own key) sends each one the evening check-in at its local time.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  tz         text not null default 'Asia/Dhaka',
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Indexes ---------------------------------------------------------------------
create index if not exists idx_tx_user_date  on public.transactions (user_id, occurred_on desc);
create index if not exists idx_mood_user_date on public.mood_logs (user_id, logged_on desc);
create index if not exists idx_cat_user on public.categories (user_id, sort);
create index if not exists idx_journal_user on public.journal_entries (user_id, entry_on desc);
create index if not exists idx_actlog_user on public.activity_logs (user_id, logged_on desc);
create index if not exists idx_memo_scans_user on public.memo_scans (user_id, created_at desc);
create index if not exists idx_boards_user on public.boards (user_id, sort);
create index if not exists idx_board_columns_board on public.board_columns (board_id, sort);
create index if not exists idx_tickets_board on public.tickets (board_id, column_id, sort);
create index if not exists idx_tickets_user on public.tickets (user_id);
create index if not exists idx_ai_requests_user on public.ai_requests (user_id, created_at desc);
create index if not exists idx_wallets_user on public.wallets (user_id, sort);
create index if not exists idx_transfers_user on public.transfers (user_id, occurred_on desc);
create index if not exists idx_debts_user on public.debts (user_id, created_at desc);
create index if not exists idx_debt_payments_debt on public.debt_payments (debt_id);
create index if not exists idx_push_user on public.push_subscriptions (user_id);
create index if not exists idx_recurring_user on public.recurring (user_id);
create index if not exists idx_recurring_due on public.recurring (next_on) where not paused;
create index if not exists idx_challenges_user on public.challenges (user_id, start_on desc);

-- Row-Level Security: enable + owner-only policies on every table -------------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','transactions','mood_logs','budgets','goals',
    'bills','journal_entries','activities','activity_logs',
    'boards','board_columns','tickets','ai_insights',
    'wallets','transfers','debts','debt_payments','push_subscriptions',
    'recurring','challenges'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_all_own', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t||'_all_own', t
    );
  end loop;
end $$;

-- memo_scans: users can add and count their own scans but never change or delete
-- them, so the daily limit can't be reset from the client.
alter table public.memo_scans enable row level security;
drop policy if exists memo_scans_insert_own on public.memo_scans;
create policy memo_scans_insert_own on public.memo_scans for insert with check (auth.uid() = user_id);
drop policy if exists memo_scans_select_own on public.memo_scans;
create policy memo_scans_select_own on public.memo_scans for select using (auth.uid() = user_id);
revoke all on public.memo_scans from anon;
revoke update, delete, truncate on public.memo_scans from authenticated;

-- ai_requests: same rules as memo_scans, for the AI summaries' daily limit.
alter table public.ai_requests enable row level security;
drop policy if exists ai_requests_insert_own on public.ai_requests;
create policy ai_requests_insert_own on public.ai_requests for insert with check (auth.uid() = user_id);
drop policy if exists ai_requests_select_own on public.ai_requests;
create policy ai_requests_select_own on public.ai_requests for select using (auth.uid() = user_id);
revoke all on public.ai_requests from anon;
revoke update, delete, truncate on public.ai_requests from authenticated;
