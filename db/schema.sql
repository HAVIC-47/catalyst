-- Catalyst — PostgreSQL schema (PRD "First Task")
-- Target: Vercel Postgres / Supabase. The local-first MVP mirrors these shapes in
-- IndexedDB (see src/lib/store.ts); switching to cloud is a drop-in at that layer.

create extension if not exists "uuid-ossp";

-- Users -----------------------------------------------------------------------
create table if not exists users (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  display_name text,
  -- "Villain Arc" strict-mode budget controls (deferred feature)
  strict_mode boolean not null default false,
  daily_budget numeric(12,2),
  created_at  timestamptz not null default now()
);

-- Mood logs -------------------------------------------------------------------
create table if not exists mood_logs (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users(id) on delete cascade,
  mood_index smallint not null check (mood_index between 1 and 10),
  label      text not null,
  note       text,
  logged_at  timestamptz not null default now()
);

-- Transactions ----------------------------------------------------------------
-- amount is signed: positive = income, negative = expense.
create table if not exists transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  mood_log_id uuid references mood_logs(id) on delete set null,
  amount      numeric(12,2) not null,
  category    text not null,
  description text not null default '',
  type        text not null check (type in ('impulse','intentional')),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Contextual metadata tags (e.g. Sleep=5hrs, Workload=High) -------------------
create table if not exists contextual_tags (
  id             uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  key            text not null,
  value          text not null
);

-- Buyer's-remorse retrospective re-rating (deferred feature) ------------------
create table if not exists remorse_checks (
  id             uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  prompted_at    timestamptz not null default now(),
  rerated_mood   smallint check (rerated_mood between 1 and 10),
  responded_at   timestamptz
);

create index if not exists idx_tx_user_time on transactions (user_id, occurred_at desc);
create index if not exists idx_tx_category on transactions (user_id, category);
create index if not exists idx_mood_user_time on mood_logs (user_id, logged_at desc);
create index if not exists idx_tags_tx on contextual_tags (transaction_id);
