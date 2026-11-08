-- 1. Adds the missing "in progress" count to the daily snapshot (needed to
--    trend the dashboard's "Firms In Progress" card and the "Total
--    Contacted" card, which both include it) and backfills today's row.
-- 2. Restores auto-detection of not_started/in_progress city status from the
--    firms table (0006 made city status manual-only across the board, which
--    went further than intended — the system genuinely can't know a city is
--    *fully* covered, but it can tell whether any firm data exists for it at
--    all). "Completed" still requires a manual mark either way.
-- Run after 0006_offers_salary_manual_cities.sql.

alter table dashboard_daily_snapshot
  add column in_progress_count int not null default 0;

create or replace function record_dashboard_snapshot()
returns void
language plpgsql
security definer
as $$
begin
  insert into dashboard_daily_snapshot (
    snapshot_date, total_firms, sent_count, responded_count, negotiation_count,
    client_count, in_progress_count, cities_completed, cities_total
  )
  select
    current_date,
    (select count(*) from firms),
    (select count(*) from firms where status = 'sent'),
    (select count(*) from firms where status = 'responded'),
    (select count(*) from firms where status = 'negotiation'),
    (select count(*) from firms where status = 'client'),
    (select count(*) from firms where status = 'in_progress'),
    (select count(*) from city_status where status = 'completed'),
    (select count(*) from city_status)
  on conflict (snapshot_date) do update set
    total_firms = excluded.total_firms,
    sent_count = excluded.sent_count,
    responded_count = excluded.responded_count,
    negotiation_count = excluded.negotiation_count,
    client_count = excluded.client_count,
    in_progress_count = excluded.in_progress_count,
    cities_completed = excluded.cities_completed,
    cities_total = excluded.cities_total,
    created_at = now();
end;
$$;

-- Backfill today's row (and any other still-current row) with the new column
-- immediately, instead of waiting for tonight's cron run.
select record_dashboard_snapshot();

-- computed_status: 'not_started' when a city has no firms at all (or every
-- firm in it is still untouched), 'in_progress' the moment any firm has
-- moved at all — never 'completed' on its own, since the tool has no way to
-- know a city's firm list is exhaustive.
create or replace view city_status_computed as
select
  country,
  state,
  city,
  count(*) as firm_count,
  count(*) filter (where status = 'not_started') as not_started_count,
  count(*) filter (where status = 'in_progress') as in_progress_count,
  case
    when count(*) filter (where status = 'not_started') = count(*) then 'not_started'
    else 'in_progress'
  end::city_manual_status as computed_status
from firms
group by country, state, city;

-- Effective status = manual override if set (any of the three, including
-- 'completed'), otherwise the auto-detected not_started/in_progress state,
-- otherwise 'not_started' for a city with neither (no firms, no override —
-- filled in at the application layer from the full known-city list, since
-- that list itself isn't in the database).
create or replace view city_status as
select
  coalesce(cc.country, s.country) as country,
  coalesce(cc.state, s.state) as state,
  coalesce(cc.city, s.city) as city,
  coalesce(s.firm_count, 0) as firm_count,
  coalesce(cc.manual_status, s.computed_status, 'not_started') as status,
  (cc.manual_status is not null) as is_manual_override,
  cc.note
from city_completion cc
full outer join city_status_computed s
  on s.country = cc.country and s.state = cc.state and s.city = cc.city;
