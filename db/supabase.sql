-- Catalyst v2 — Supabase schema (separate money + mood model, multi-page app).
-- Run in Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Tables: categories, transactions, mood_logs (Phase 1) +
-- budgets, goals, bills, journal_entries, activities, activity_logs (later phases).
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

-- Indexes ---------------------------------------------------------------------
create index if not exists idx_tx_user_date  on public.transactions (user_id, occurred_on desc);
create index if not exists idx_mood_user_date on public.mood_logs (user_id, logged_on desc);
create index if not exists idx_cat_user on public.categories (user_id, sort);
create index if not exists idx_journal_user on public.journal_entries (user_id, entry_on desc);
create index if not exists idx_actlog_user on public.activity_logs (user_id, logged_on desc);

-- Row-Level Security: enable + owner-only policies on every table -------------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','transactions','mood_logs','budgets','goals',
    'bills','journal_entries','activities','activity_logs'
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
