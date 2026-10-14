-- Catalyst v2 — Supabase schema (separate money + mood model, multi-page app).
-- Run in Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Tables: categories, transactions, mood_logs (Phase 1) +
-- budgets, goals, bills, journal_entries, activities, activity_logs (later phases) +
-- memo_scans (daily limit for the memo reader) +
-- boards, board_columns, tickets (to-do and to-buy boards) +
-- ai_insights, ai_requests (saved AI summaries and their daily limit).
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
  topic      text not null check (topic in ('journal','ledger','goals','savings','bills','mood','todo','shopping')),
  period     text not null check (period in ('week','month','year')),
  start_on   date not null,
  data_hash  text not null default '',
  content    jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, topic, period, start_on)
);
-- Topics added after the table was first created (to-do and to-buy boards).
alter table public.ai_insights drop constraint if exists ai_insights_topic_check;
alter table public.ai_insights add constraint ai_insights_topic_check
  check (topic in ('journal','ledger','goals','savings','bills','mood','todo','shopping'));

-- AI REQUESTS (one row per summary written with the server's Gemini key) -------
-- Like memo_scans: holds no content, only caps summaries per account per day.
create table if not exists public.ai_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic      text not null default '',
  created_at timestamptz not null default now()
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

-- Row-Level Security: enable + owner-only policies on every table -------------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','transactions','mood_logs','budgets','goals',
    'bills','journal_entries','activities','activity_logs',
    'boards','board_columns','tickets','ai_insights'
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
