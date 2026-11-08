-- Live updates: publish the data tables to Supabase Realtime so the app can refresh stats the moment
-- something changes (another person edits a firm, a status moves, the nightly snapshot runs, ...).
-- Realtime only delivers rows the signed-in user is allowed to read (row level security still applies).
-- Run after 0010_firm_website.sql. Safe to re-run.

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'firms', 'city_completion', 'angebots', 'invoices', 'employees', 'contracts',
      'firm_status_history', 'dashboard_daily_snapshot'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
