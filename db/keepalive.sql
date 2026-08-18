-- Catalyst — keepalive row.
-- Supabase free projects pause after ~7 days of no activity. An hourly cron bumps
-- last_ping here. A write is unambiguous database activity; a read alone may or
-- may not register, which is the whole reason this table exists.
--
-- Run in Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Unlike every other table this one is NOT user-scoped — it holds one row and no
-- user data. It is also not reachable through the REST API at all: RLS is on with
-- no policies, so the only way in is keepalive_ping(), which can do exactly one
-- thing. Nothing here is publicly writable.

create table if not exists public.keepalive (
  id        smallint primary key default 1,
  last_ping timestamptz not null default now(),
  constraint keepalive_single_row check (id = 1)
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;

-- security definer: runs as the owner, so it bumps the row without the caller
-- needing any rights on the table. Returns the new value so callers can prove
-- the write landed rather than trusting a 200.
create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.keepalive set last_ping = now() where id = 1
  returning last_ping;
$$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;
