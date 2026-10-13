-- Catalyst — database hardening. Run after db/supabase.sql and db/keepalive.sql:
-- Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Nothing here deletes data. It only takes access away from the public API and
-- adds limits to future writes.

-- 1. Deny by default. Every table in `public` is reachable through the REST API
--    with the anon key (which ships inside the web and Android apps) unless RLS
--    is on. The app's tables already have it; this catches anything left over,
--    such as the v1 `entries` table. RLS with no policy means no API access at
--    all — the rows stay, and the dashboard / SQL editor can still read them.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    raise notice 'RLS was off on public.% — now on (no API access)', r.relname;
  end loop;
end $$;

-- 2. The v1 single-table model. The app stopped using it in v2; keep the rows
--    but take every API grant away.
do $$
begin
  if to_regclass('public.entries') is not null then
    revoke all on public.entries from anon, authenticated;
  end if;
end $$;

-- 3. Signed-out visitors never need table access — the app only queries after
--    login, and RLS already returns nothing to anon (auth.uid() is null). Taking
--    the grants away too means a future policy mistake can't hand data to the
--    public key.
revoke all on
  public.categories, public.transactions, public.mood_logs, public.budgets, public.goals,
  public.bills, public.journal_entries, public.activities, public.activity_logs,
  public.boards, public.board_columns, public.tickets, public.ai_insights
from anon;

-- 4. Size and format limits. RLS stops users touching each other's rows, but
--    without limits one account could still fill the free-tier database with
--    megabyte-long notes. The web and Android inputs stop at the same lengths
--    (src/lib/limits.ts, lib/limits.dart).
--    Each check is added NOT VALID (applies to new writes only) and then
--    validated. If an existing row is already over a limit, validation is skipped
--    with a notice and that row is left alone.
do $$
declare c record;
begin
  for c in
    select * from (values
      ('categories',      'categories_name_len',            'char_length(name) <= 100'),
      ('categories',      'categories_color_hex',           $c$color ~ '^#[0-9A-Fa-f]{6}$'$c$),
      ('transactions',    'transactions_category_name_len', 'char_length(category_name) <= 100'),
      ('transactions',    'transactions_place_len',         'char_length(place) <= 200'),
      ('transactions',    'transactions_note_len',          'char_length(note) <= 1000'),
      ('mood_logs',       'mood_logs_note_len',             'char_length(note) <= 1000'),
      ('mood_logs',       'mood_logs_tags_shape',           $c$case when jsonb_typeof(tags) = 'array' then jsonb_array_length(tags) <= 50 and octet_length(tags::text) <= 4000 else false end$c$),
      ('budgets',         'budgets_category_name_len',      'char_length(category_name) <= 100'),
      ('budgets',         'budgets_period_valid',           $c$period in ('weekly', 'monthly', 'yearly')$c$),
      ('goals',           'goals_title_len',                'char_length(title) <= 200'),
      ('bills',           'bills_name_len',                 'char_length(name) <= 100'),
      ('bills',           'bills_recurrence_valid',         $c$recurrence in ('weekly', 'monthly', 'yearly', 'once')$c$),
      ('journal_entries', 'journal_entries_title_len',      'char_length(title) <= 200'),
      ('journal_entries', 'journal_entries_body_len',       'char_length(body) <= 20000'),
      ('activities',      'activities_name_len',            'char_length(name) <= 100'),
      ('activities',      'activities_color_hex',           $c$color ~ '^#[0-9A-Fa-f]{6}$'$c$),
      ('activity_logs',   'activity_logs_value_len',        'char_length(value) <= 100'),
      ('boards',          'boards_name_len',                'char_length(name) <= 100'),
      ('board_columns',   'board_columns_name_len',         'char_length(name) <= 100'),
      ('tickets',         'tickets_title_len',              'char_length(title) <= 200'),
      ('tickets',         'tickets_description_len',        'char_length(description) <= 5000'),
      ('ai_insights',     'ai_insights_hash_len',           'char_length(data_hash) <= 64'),
      ('ai_insights',     'ai_insights_content_size',       'octet_length(content::text) <= 20000')
    ) as v(tbl, con, expr)
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = c.con and conrelid = format('public.%I', c.tbl)::regclass
    ) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.con, c.expr);
    end if;
    begin
      execute format('alter table public.%I validate constraint %I', c.tbl, c.con);
    exception when check_violation then
      raise notice '%: some existing rows are over the limit — enforced for new writes only', c.con;
    end;
  end loop;
end $$;
