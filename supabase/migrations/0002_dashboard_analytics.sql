-- Dashboard analytics: firm status audit trail + daily snapshots for trend deltas.
-- Run this after 0001_init.sql (SQL editor, or `supabase db push`).
--
-- This file is identical to the "DASHBOARD ANALYTICS" section appended to
-- supabase/schema.sql — kept here too so `supabase db push` picks it up as
-- an incremental migration on a database that already ran 0001_init.sql.

-- ============================================================================
-- FIRM STATUS HISTORY (audit trail — who changed a firm's status and when)
-- ============================================================================

create table firm_status_history (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  old_status firm_status,
  new_status firm_status not null,
  changed_by uuid references app_users (id),
  changed_at timestamptz not null default now()
);

create index firm_status_history_firm_idx on firm_status_history (firm_id);
create index firm_status_history_changed_at_idx on firm_status_history (changed_at desc);

create or replace function log_firm_status_change()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    insert into firm_status_history (firm_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into firm_status_history (firm_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger firms_log_status_change
  after insert or update on firms
  for each row execute function log_firm_status_change();

-- Convenience view for the dashboard's "Recent Activity" feed — joins in the
-- firm name/location and the operator's name so the UI doesn't need to.
create or replace view firm_status_history_feed as
select
  h.id,
  h.firm_id,
  f.name as firm_name,
  f.city,
  f.country,
  h.old_status,
  h.new_status,
  h.changed_by,
  u.full_name as changed_by_name,
  h.changed_at
from firm_status_history h
join firms f on f.id = h.firm_id
left join app_users u on u.id = h.changed_by
order by h.changed_at desc;

-- ============================================================================
-- DASHBOARD DAILY SNAPSHOT (for "vs last month" trend deltas on stat cards)
-- ============================================================================

create table dashboard_daily_snapshot (
  snapshot_date date primary key,
  total_firms int not null,
  sent_count int not null,
  responded_count int not null,
  interested_count int not null,
  client_count int not null,
  cities_completed int not null,
  cities_total int not null,
  created_at timestamptz not null default now()
);

create or replace function record_dashboard_snapshot()
returns void
language plpgsql
security definer
as $$
begin
  insert into dashboard_daily_snapshot (
    snapshot_date, total_firms, sent_count, responded_count, interested_count,
    client_count, cities_completed, cities_total
  )
  select
    current_date,
    (select count(*) from firms),
    (select count(*) from firms where status = 'sent'),
    (select count(*) from firms where status = 'responded'),
    (select count(*) from firms where status = 'interested'),
    (select count(*) from firms where status = 'client'),
    (select count(*) from city_status where status = 'completed'),
    (select count(*) from city_status)
  on conflict (snapshot_date) do update set
    total_firms = excluded.total_firms,
    sent_count = excluded.sent_count,
    responded_count = excluded.responded_count,
    interested_count = excluded.interested_count,
    client_count = excluded.client_count,
    cities_completed = excluded.cities_completed,
    cities_total = excluded.cities_total,
    created_at = now();
end;
$$;

-- Schedule the nightly snapshot via pg_cron. If your Supabase project has
-- pg_cron disabled (Database -> Extensions in the dashboard on some plans
-- requires enabling it there first), run just this "create extension" line
-- from the dashboard UI, then re-run the block below.
create extension if not exists pg_cron with schema extensions;

do $$
begin
  perform cron.unschedule('dashboard-daily-snapshot');
exception when others then
  null; -- job didn't exist yet — fine on first run
end $$;

select cron.schedule(
  'dashboard-daily-snapshot',
  '5 0 * * *', -- 00:05 UTC daily
  $$select record_dashboard_snapshot();$$
);

-- Take one snapshot now so "today" has a baseline row immediately, instead
-- of waiting for the first scheduled run.
select record_dashboard_snapshot();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table firm_status_history enable row level security;
alter table dashboard_daily_snapshot enable row level security;

-- The original schema only let a user read their OWN app_users row. The
-- activity feed needs to show *other* operators' names (e.g. "Jonas Berg
-- moved Siemens Mobility to Client"), so widen read access to the whole
-- (small, leadership-only) allowlist — still no write access to other rows.
create policy "app_users can read all app_users" on app_users
  for select using (is_app_user());

create policy "app_users can read firm_status_history" on firm_status_history
  for select using (is_app_user());
-- No insert/update/delete policy — rows are only ever written by the
-- security-definer trigger function above, never directly by clients.

create policy "app_users can read dashboard_daily_snapshot" on dashboard_daily_snapshot
  for select using (is_app_user());
