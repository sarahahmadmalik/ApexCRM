-- Combined ApexCRM Sample Database Setup (0001 through 0013 + CRM Seed Data)

-- ============================================================================
-- MIGRATION: 0001_init.sql
-- ============================================================================
-- Dua Dev internal tool â€” initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

do $$ begin
  create type firm_status as enum (
  'not_started',   -- no outreach yet
  'in_progress',   -- currently sending / working on this firm
  'sent',          -- proposal email sent
  'responded',     -- firm replied
  'interested',    -- firm is close to becoming a client (negotiating)
  'client'         -- firm has become a client
);
exception when duplicate_object then null;
end $$;

do $$ begin
  create type city_manual_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type angebot_status as enum ('draft', 'sent', 'signed', 'rejected', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type contract_status as enum ('draft', 'final');
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- APP USERS (allowlist â€” only CEO / CTO get access to this tool)
-- ============================================================================

create table if not exists app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('ceo', 'cto')),
  created_at timestamptz not null default now()
);

create or replace function is_app_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from app_users where id = auth.uid());
$$;

-- ============================================================================
-- FIRMS (outreach tracking)
-- ============================================================================

create table if not exists firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  state text not null,
  city text not null,
  status firm_status not null default 'not_started',
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_by uuid references app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists firms_country_idx on firms (country);
create index if not exists firms_city_idx on firms (city);
create index if not exists firms_status_idx on firms (status);
create index if not exists firms_name_trgm_idx on firms using gin (to_tsvector('simple', name));

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger firms_set_updated_at
  before update on firms
  for each row execute function set_updated_at();

-- ============================================================================
-- CITY COMPLETION (manual override / notes on top of computed status)
-- ============================================================================

create table if not exists city_completion (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  state text not null,
  city text not null,
  manual_status city_manual_status,      -- null = use computed status from firms
  note text,
  updated_at timestamptz not null default now(),
  unique (country, state, city)
);

-- Computed status per city from the firms table:
--  - no firms, or all firms 'not_started'      -> not_started
--  - any firm 'in_progress'                     -> in_progress
--  - some firms done, some not_started (no      -> in_progress
--    'in_progress' firms, but not all finished)
--  - every firm has progressed past             -> completed
--    not_started/in_progress
create or replace view city_status_computed as
select
  country,
  state,
  city,
  count(*) as firm_count,
  count(*) filter (where status = 'not_started') as not_started_count,
  count(*) filter (where status = 'in_progress') as in_progress_count,
  case
    when count(*) filter (where status = 'in_progress') > 0 then 'in_progress'
    when count(*) filter (where status = 'not_started') = count(*) then 'not_started'
    when count(*) filter (where status = 'not_started') > 0 then 'in_progress'
    else 'completed'
  end::city_manual_status as computed_status
from firms
group by country, state, city;

-- Effective status = manual override if set, otherwise computed
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

-- ============================================================================
-- EMPLOYEES
-- ============================================================================

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  country text,
  position text,
  email text,
  phone text,
  has_contract boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employees_set_updated_at
  before update on employees
  for each row execute function set_updated_at();

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  status contract_status not null default 'draft',
  data jsonb not null default '{}'::jsonb,   -- structured fields used to fill the contract template
  file_path text,                             -- storage path of generated .docx/.pdf
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contracts_set_updated_at
  before update on contracts
  for each row execute function set_updated_at();

-- keep employees.has_contract in sync
create or replace function sync_employee_has_contract()
returns trigger language plpgsql as $$
begin
  update employees set has_contract = true where id = coalesce(new.employee_id, old.employee_id);
  return coalesce(new, old);
end;
$$;

create trigger contracts_sync_employee
  after insert on contracts
  for each row execute function sync_employee_has_contract();

-- ============================================================================
-- AUTO-NUMBERING (atomic, never repeats)
-- ============================================================================

create table if not exists counters (
  key text primary key,
  value integer not null default 0
);

create or replace function next_counter(p_key text)
returns integer
language plpgsql
security definer
as $$
declare
  v_value integer;
begin
  insert into counters (key, value) values (p_key, 1)
  on conflict (key) do update set value = counters.value + 1
  returning value into v_value;
  return v_value;
end;
$$;

-- Format: A-2026-0001
create or replace function next_angebot_number()
returns text
language plpgsql
security definer
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_seq integer;
begin
  v_seq := next_counter('angebot_' || v_year);
  return 'A-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Format: 2026-00001
create or replace function next_invoice_number()
returns text
language plpgsql
security definer
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_seq integer;
begin
  v_seq := next_counter('invoice_' || v_year);
  return v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- ============================================================================
-- ANGEBOTS (offers / quotes)
-- ============================================================================

create table if not exists angebots (
  id uuid primary key default gen_random_uuid(),
  angebot_number text not null unique default next_angebot_number(),
  firm_id uuid not null references firms (id),
  issue_date date not null default current_date,
  valid_until date,
  line_items jsonb not null default '[]'::jsonb, -- [{description, quantity, unit_price}]
  vat_rate numeric(5,2) not null default 19,
  net_amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status angebot_status not null default 'draft',
  file_path text,
  created_by uuid references app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger angebots_set_updated_at
  before update on angebots
  for each row execute function set_updated_at();

-- Signing an Angebot promotes the firm to 'client'
create or replace function angebot_signed_promotes_firm()
returns trigger language plpgsql as $$
begin
  if new.status = 'signed' and (old.status is distinct from new.status) then
    update firms set status = 'client' where id = new.firm_id and status <> 'client';
  end if;
  return new;
end;
$$;

create trigger angebots_promote_firm
  after update on angebots
  for each row execute function angebot_signed_promotes_firm();

-- ============================================================================
-- INVOICES (Rechnungen)
-- ============================================================================

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default next_invoice_number(),
  firm_id uuid not null references firms (id),
  angebot_id uuid references angebots (id),
  issue_date date not null default current_date,
  due_date date,
  service_period_start date,
  service_period_end date,
  line_items jsonb not null default '[]'::jsonb,
  vat_rate numeric(5,2) not null default 19,
  net_amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status invoice_status not null default 'draft',
  file_path text,
  created_by uuid references app_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY â€” every table only readable/writable by allowlisted
-- CEO / CTO users (rows in app_users). No public/anon access anywhere.
-- ============================================================================

alter table app_users enable row level security;
alter table firms enable row level security;
alter table city_completion enable row level security;
alter table employees enable row level security;
alter table contracts enable row level security;
alter table counters enable row level security;
alter table angebots enable row level security;
alter table invoices enable row level security;

create policy "app_users read self" on app_users for select using (id = auth.uid());

create policy "app_users can read firms" on firms for select using (is_app_user());
create policy "app_users can write firms" on firms for insert with check (is_app_user());
create policy "app_users can update firms" on firms for update using (is_app_user());
create policy "app_users can delete firms" on firms for delete using (is_app_user());

create policy "app_users can read city_completion" on city_completion for select using (is_app_user());
create policy "app_users can write city_completion" on city_completion for insert with check (is_app_user());
create policy "app_users can update city_completion" on city_completion for update using (is_app_user());
create policy "app_users can delete city_completion" on city_completion for delete using (is_app_user());

create policy "app_users can read employees" on employees for select using (is_app_user());
create policy "app_users can write employees" on employees for insert with check (is_app_user());
create policy "app_users can update employees" on employees for update using (is_app_user());
create policy "app_users can delete employees" on employees for delete using (is_app_user());

create policy "app_users can read contracts" on contracts for select using (is_app_user());
create policy "app_users can write contracts" on contracts for insert with check (is_app_user());
create policy "app_users can update contracts" on contracts for update using (is_app_user());
create policy "app_users can delete contracts" on contracts for delete using (is_app_user());

create policy "app_users can read counters" on counters for select using (is_app_user());

create policy "app_users can read angebots" on angebots for select using (is_app_user());
create policy "app_users can write angebots" on angebots for insert with check (is_app_user());
create policy "app_users can update angebots" on angebots for update using (is_app_user());
create policy "app_users can delete angebots" on angebots for delete using (is_app_user());

create policy "app_users can read invoices" on invoices for select using (is_app_user());
create policy "app_users can write invoices" on invoices for insert with check (is_app_user());
create policy "app_users can update invoices" on invoices for update using (is_app_user());
create policy "app_users can delete invoices" on invoices for delete using (is_app_user());

-- ============================================================================
-- STORAGE (generated documents: angebots, invoices, contracts)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "app_users can read documents"
  on storage.objects for select
  using (bucket_id = 'documents' and is_app_user());

create policy "app_users can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and is_app_user());

create policy "app_users can update documents"
  on storage.objects for update
  using (bucket_id = 'documents' and is_app_user());

create policy "app_users can delete documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and is_app_user());


-- ============================================================================
-- MIGRATION: 0002_dashboard_analytics.sql
-- ============================================================================
-- Dashboard analytics: firm status audit trail + daily snapshots for trend deltas.
-- Run this after 0001_init.sql (SQL editor, or `supabase db push`).
--
-- This file is identical to the "DASHBOARD ANALYTICS" section appended to
-- supabase/schema.sql â€” kept here too so `supabase db push` picks it up as
-- an incremental migration on a database that already ran 0001_init.sql.

-- ============================================================================
-- FIRM STATUS HISTORY (audit trail â€” who changed a firm's status and when)
-- ============================================================================

create table if not exists firm_status_history (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  old_status firm_status,
  new_status firm_status not null,
  changed_by uuid references app_users (id),
  changed_at timestamptz not null default now()
);

create index if not exists firm_status_history_firm_idx on firm_status_history (firm_id);
create index if not exists firm_status_history_changed_at_idx on firm_status_history (changed_at desc);

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

-- Convenience view for the dashboard's "Recent Activity" feed â€” joins in the
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

create table if not exists dashboard_daily_snapshot (
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
  null; -- job didn't exist yet â€” fine on first run
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
-- (small, leadership-only) allowlist â€” still no write access to other rows.
create policy "app_users can read all app_users" on app_users
  for select using (is_app_user());

create policy "app_users can read firm_status_history" on firm_status_history
  for select using (is_app_user());
-- No insert/update/delete policy â€” rows are only ever written by the
-- security-definer trigger function above, never directly by clients.

create policy "app_users can read dashboard_daily_snapshot" on dashboard_daily_snapshot
  for select using (is_app_user());


-- ============================================================================
-- MIGRATION: 0003_rename_interested_to_negotiation.sql
-- ============================================================================
-- Replace 'interested' with 'negotiation' in the firm_status enum
-- PostgreSQL doesn't allow renaming enum values directly before PG 10.
-- In Supabase (PG 15+), we can use ALTER TYPE ... RENAME VALUE
ALTER TYPE firm_status RENAME VALUE 'interested' TO 'negotiation';

-- Rename the column in the daily snapshot table
ALTER TABLE dashboard_daily_snapshot RENAME COLUMN interested_count TO negotiation_count;

-- Update the recording function to query 'negotiation' instead of 'interested'
CREATE OR REPLACE FUNCTION record_dashboard_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO dashboard_daily_snapshot (
    snapshot_date, total_firms, sent_count, responded_count, negotiation_count,
    client_count, cities_completed, cities_total
  )
  SELECT
    current_date,
    (SELECT count(*) FROM firms),
    (SELECT count(*) FROM firms WHERE status = 'sent'),
    (SELECT count(*) FROM firms WHERE status = 'responded'),
    (SELECT count(*) FROM firms WHERE status = 'negotiation'),
    (SELECT count(*) FROM firms WHERE status = 'client'),
    (SELECT count(*) FROM city_status WHERE status = 'completed'),
    (SELECT count(*) FROM city_status)
  ON CONFLICT (snapshot_date) DO UPDATE SET
    total_firms = EXCLUDED.total_firms,
    sent_count = EXCLUDED.sent_count,
    responded_count = EXCLUDED.responded_count,
    negotiation_count = EXCLUDED.negotiation_count,
    client_count = EXCLUDED.client_count,
    cities_completed = EXCLUDED.cities_completed,
    cities_total = EXCLUDED.cities_total,
    created_at = now();
END;
$$;


-- ============================================================================
-- MIGRATION: 0004_employee_employment_type.sql
-- ============================================================================
-- Employment type on the employee roster (full time / part time / contract).
-- Run after 0003_rename_interested_to_negotiation.sql.

do $$ begin
  create type employment_type as enum ('full_time', 'part_time', 'contract');
exception when duplicate_object then null;
end $$;

alter table employees
  add column employment_type employment_type not null default 'full_time';


-- ============================================================================
-- MIGRATION: 0005_employee_contract_dates.sql
-- ============================================================================
-- Contract duration for contract-based employees.
-- Run after 0004_employee_employment_type.sql.

alter table employees
  add column contract_start_date date,
  add column contract_end_date date;

-- Only contract-based staff carry a duration, and it must run forwards.
alter table employees
  add constraint employees_contract_dates_valid
  check (
    contract_end_date is null
    or contract_start_date is null
    or contract_end_date >= contract_start_date
  );


-- ============================================================================
-- MIGRATION: 0006_offers_salary_manual_cities.sql
-- ============================================================================
-- Offers statuses, employee salary, and manual-only city status.
-- Run after 0005_employee_contract_dates.sql.

-- ---------------------------------------------------------------------------
-- 1. Offer (Angebot) statuses: draft / sent / accepted / rejected
--    Existing 'signed' offers become 'accepted'; 'expired' ones 'rejected'.
-- ---------------------------------------------------------------------------

alter type angebot_status rename to angebot_status_old;
do $$ begin
  create type angebot_status as enum ('draft', 'sent', 'accepted', 'rejected');
exception when duplicate_object then null;
end $$;

alter table angebots alter column status drop default;
alter table angebots
  alter column status type angebot_status
  using (
    case status::text
      when 'signed' then 'accepted'
      when 'expired' then 'rejected'
      else status::text
    end
  )::angebot_status;
alter table angebots alter column status set default 'draft';

drop type angebot_status_old;

-- Accepting an offer promotes the firm to 'client' (was: signing).
create or replace function angebot_signed_promotes_firm()
returns trigger language plpgsql as $$
begin
  if new.status = 'accepted' and (old.status is distinct from new.status) then
    update firms set status = 'client' where id = new.firm_id and status <> 'client';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Employee salary, entered per month or per year
-- ---------------------------------------------------------------------------

alter table employees
  add column salary_amount numeric(12, 2),
  add column salary_period text;

alter table employees
  add constraint employees_salary_valid
  check (
    (salary_amount is null and salary_period is null)
    or (salary_amount > 0 and salary_period in ('month', 'year'))
  );

-- ---------------------------------------------------------------------------
-- 3. City status is set by hand only. The firms table can't tell how many
--    firms exist in an area, so "completed" can't be derived from it.
--    Cities without a manual status are 'not_started'.
-- ---------------------------------------------------------------------------

create or replace view city_status as
select
  coalesce(cc.country, s.country) as country,
  coalesce(cc.state, s.state) as state,
  coalesce(cc.city, s.city) as city,
  coalesce(s.firm_count, 0) as firm_count,
  coalesce(cc.manual_status, 'not_started') as status,
  (cc.manual_status is not null) as is_manual_override,
  cc.note
from city_completion cc
full outer join city_status_computed s
  on s.country = cc.country and s.state = cc.state and s.city = cc.city;


-- ============================================================================
-- MIGRATION: 0007_snapshot_in_progress_and_geo_cities.sql
-- ============================================================================
-- 1. Adds the missing "in progress" count to the daily snapshot (needed to
--    trend the dashboard's "Firms In Progress" card and the "Total
--    Contacted" card, which both include it) and backfills today's row.
-- 2. Restores auto-detection of not_started/in_progress city status from the
--    firms table (0006 made city status manual-only across the board, which
--    went further than intended â€” the system genuinely can't know a city is
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
-- moved at all â€” never 'completed' on its own, since the tool has no way to
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
-- otherwise 'not_started' for a city with neither (no firms, no override â€”
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


-- ============================================================================
-- MIGRATION: 0008_theme_preference.sql
-- ============================================================================
-- Stores each leadership user's theme choice on their account, so it follows
-- them to a new browser or device instead of living only in that browser's
-- localStorage. Null means "no preference saved yet" â€” the app falls back
-- to the browser's own local/system setting.
-- Run after 0007_snapshot_in_progress_and_geo_cities.sql.

alter table app_users
  add column theme_preference text check (theme_preference in ('light', 'dark', 'system'));


-- ============================================================================
-- MIGRATION: 0009_workspaces_permissions.sql
-- ============================================================================
-- Workspaces + per-page permissions.
--
-- Adds:
--   * workspaces               â€” the default "Dua Dev" workspace (one for now)
--   * app_users.workspace_id / account_role ('admin' | 'user') / is_active
--   * app_users.role           â€” now the free-text COMPANY position (CTO, Designer, ...)
--   * user_permissions         â€” per-user, per-page 'read' | 'write' (no row = no access)
--   * has_page_access()        â€” used by RLS so the database enforces the same rules as the UI
--
-- Members are created by the admin through the app (Supabase Admin API, service
-- key on the server) â€” nothing here lets a signed-in user change roles or
-- permissions, including their own.
-- Run after 0008_theme_preference.sql, then run scripts/create_admin_saramalik.sql.

-- ============================================================================
-- WORKSPACES
-- ============================================================================

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

insert into workspaces (id, name)
values ('00000000-0000-0000-0000-00000000d0a0', 'Dua Dev');

-- ============================================================================
-- APP USERS
-- ============================================================================

-- `role` used to be limited to ceo / cto. It is the company position now and
-- can be any text ("CTO", "Designer", ...).
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check check (char_length(btrim(role)) between 1 and 60);

alter table app_users
  add column workspace_id uuid references workspaces (id),
  add column account_role text not null default 'user' check (account_role in ('admin', 'user')),
  add column is_active boolean not null default true;

comment on column app_users.role is 'Company position, free text (e.g. CTO). Not an access role â€” see account_role.';
comment on column app_users.account_role is 'Access role: admin (manages the workspace, full access) or user (page permissions apply).';

update app_users set workspace_id = '00000000-0000-0000-0000-00000000d0a0' where workspace_id is null;
alter table app_users alter column workspace_id set not null;
-- Single default workspace for now: inserts that don't name one (seed.sql, older scripts) land in it.
alter table app_users alter column workspace_id set default '00000000-0000-0000-0000-00000000d0a0';

-- One admin per workspace is enough for now; the app never creates a second one.
create unique index if not exists app_users_one_admin_per_workspace on app_users (workspace_id) where account_role = 'admin';

-- ============================================================================
-- PAGE PERMISSIONS
-- ============================================================================

create table if not exists user_permissions (
  user_id uuid not null references app_users (id) on delete cascade,
  page text not null check (page in ('dashboard', 'firms', 'cities', 'employees', 'contracts', 'offers', 'invoices')),
  access text not null check (access in ('read', 'write')),
  primary key (user_id, page)
);

-- Everyone who already had access keeps it (full read & write) so this
-- migration doesn't lock anybody out. The admin can tighten it afterwards.
insert into user_permissions (user_id, page, access)
select u.id, p.page, 'write'
from app_users u
cross join (values ('dashboard'), ('firms'), ('cities'), ('employees'), ('contracts'), ('offers'), ('invoices')) as p (page);

-- ============================================================================
-- HELPERS (security definer so RLS policies can call them without recursion)
-- ============================================================================

create or replace function is_app_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from app_users where id = auth.uid() and is_active);
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from app_users where id = auth.uid() and is_active and account_role = 'admin');
$$;

-- p_level: 'read' (a read OR write grant satisfies it) or 'write' (write grant only).
-- Admins pass every check.
create or replace function has_page_access(p_page text, p_level text default 'read')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from app_users u
    where u.id = auth.uid()
      and u.is_active
      and (
        u.account_role = 'admin'
        or exists (
          select 1
          from user_permissions up
          where up.user_id = u.id
            and up.page = p_page
            and (p_level = 'read' or up.access = 'write')
        )
      )
  );
$$;

-- True when the caller can read at least one of the pages â€” for tables that
-- several pages display (firms appear on offers/invoices/cities/dashboard).
create or replace function has_any_page_access(p_pages text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from unnest(p_pages) as p where has_page_access(p, 'read'));
$$;

-- These triggers write to other tables on the user's behalf (accepting an offer
-- promotes the firm, a contract flips employees.has_contract). They must keep
-- working for a member who can edit offers/contracts but not firms/employees.
alter function angebot_signed_promotes_firm() security definer set search_path = public;
alter function sync_employee_has_contract() security definer set search_path = public;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table workspaces enable row level security;
alter table user_permissions enable row level security;

create policy "members read own workspace" on workspaces
  for select using (id = (select workspace_id from app_users where id = auth.uid()) and is_app_user());

create policy "read own permissions" on user_permissions
  for select using (user_id = auth.uid() or is_admin());

-- app_users: a signed-in user may change ONLY their own theme. Everything else
-- (name, position, account_role, is_active, permissions) goes through the admin
-- server actions using the service key.
revoke insert, update, delete on app_users from anon, authenticated;
grant update (theme_preference) on app_users to authenticated;
create policy "app_users update own theme" on app_users
  for update using (id = auth.uid() and is_app_user()) with check (id = auth.uid());

revoke insert, update, delete on user_permissions from anon, authenticated;
revoke insert, update, delete on workspaces from anon, authenticated;

-- Data tables: replace the blanket "any app user" policies with page-based ones.
drop policy if exists "app_users can read firms" on firms;
drop policy if exists "app_users can write firms" on firms;
drop policy if exists "app_users can update firms" on firms;
drop policy if exists "app_users can delete firms" on firms;
create policy "page access read firms" on firms
  for select using (has_any_page_access(array['firms', 'dashboard', 'cities', 'offers', 'invoices']));
create policy "page access insert firms" on firms for insert with check (has_page_access('firms', 'write'));
create policy "page access update firms" on firms for update using (has_page_access('firms', 'write'));
create policy "page access delete firms" on firms for delete using (has_page_access('firms', 'write'));

drop policy if exists "app_users can read city_completion" on city_completion;
drop policy if exists "app_users can write city_completion" on city_completion;
drop policy if exists "app_users can update city_completion" on city_completion;
drop policy if exists "app_users can delete city_completion" on city_completion;
create policy "page access read city_completion" on city_completion
  for select using (has_any_page_access(array['cities', 'dashboard']));
create policy "page access insert city_completion" on city_completion for insert with check (has_page_access('cities', 'write'));
create policy "page access update city_completion" on city_completion for update using (has_page_access('cities', 'write'));
create policy "page access delete city_completion" on city_completion for delete using (has_page_access('cities', 'write'));

drop policy if exists "app_users can read employees" on employees;
drop policy if exists "app_users can write employees" on employees;
drop policy if exists "app_users can update employees" on employees;
drop policy if exists "app_users can delete employees" on employees;
create policy "page access read employees" on employees
  for select using (has_any_page_access(array['employees', 'contracts', 'dashboard']));
create policy "page access insert employees" on employees for insert with check (has_page_access('employees', 'write'));
create policy "page access update employees" on employees for update using (has_page_access('employees', 'write'));
create policy "page access delete employees" on employees for delete using (has_page_access('employees', 'write'));

drop policy if exists "app_users can read contracts" on contracts;
drop policy if exists "app_users can write contracts" on contracts;
drop policy if exists "app_users can update contracts" on contracts;
drop policy if exists "app_users can delete contracts" on contracts;
create policy "page access read contracts" on contracts
  for select using (has_any_page_access(array['contracts', 'employees']));
create policy "page access insert contracts" on contracts for insert with check (has_page_access('contracts', 'write'));
create policy "page access update contracts" on contracts for update using (has_page_access('contracts', 'write'));
create policy "page access delete contracts" on contracts for delete using (has_page_access('contracts', 'write'));

drop policy if exists "app_users can read angebots" on angebots;
drop policy if exists "app_users can write angebots" on angebots;
drop policy if exists "app_users can update angebots" on angebots;
drop policy if exists "app_users can delete angebots" on angebots;
create policy "page access read angebots" on angebots
  for select using (has_any_page_access(array['offers', 'invoices', 'dashboard']));
create policy "page access insert angebots" on angebots for insert with check (has_page_access('offers', 'write'));
create policy "page access update angebots" on angebots for update using (has_page_access('offers', 'write'));
create policy "page access delete angebots" on angebots for delete using (has_page_access('offers', 'write'));

drop policy if exists "app_users can read invoices" on invoices;
drop policy if exists "app_users can write invoices" on invoices;
drop policy if exists "app_users can update invoices" on invoices;
drop policy if exists "app_users can delete invoices" on invoices;
create policy "page access read invoices" on invoices
  for select using (has_any_page_access(array['invoices', 'dashboard']));
create policy "page access insert invoices" on invoices for insert with check (has_page_access('invoices', 'write'));
create policy "page access update invoices" on invoices for update using (has_page_access('invoices', 'write'));
create policy "page access delete invoices" on invoices for delete using (has_page_access('invoices', 'write'));

drop policy if exists "app_users can read counters" on counters;
create policy "page access read counters" on counters
  for select using (has_any_page_access(array['offers', 'invoices']));

-- ============================================================================
-- Deleting a member must not be blocked by records they created (or by the
-- status changes they made) â€” keep the records, drop the attribution.
-- ============================================================================

alter table firms drop constraint if exists firms_created_by_fkey;
alter table firms add constraint firms_created_by_fkey foreign key (created_by) references app_users (id) on delete set null;

alter table angebots drop constraint if exists angebots_created_by_fkey;
alter table angebots add constraint angebots_created_by_fkey foreign key (created_by) references app_users (id) on delete set null;

alter table invoices drop constraint if exists invoices_created_by_fkey;
alter table invoices add constraint invoices_created_by_fkey foreign key (created_by) references app_users (id) on delete set null;

alter table firm_status_history drop constraint if exists firm_status_history_changed_by_fkey;
alter table firm_status_history add constraint firm_status_history_changed_by_fkey foreign key (changed_by) references app_users (id) on delete set null;


-- ============================================================================
-- MIGRATION: 0010_firm_website.sql
-- ============================================================================
-- Firm website.
--
-- The Firms form, the CSV import and the company look-up all read/write
-- `firms.website`, but no earlier migration ever created the column â€” so saving
-- a firm failed on a database built from the migrations ("column website does
-- not exist"). Optional free text, like the other contact fields.
-- Run after 0009_workspaces_permissions.sql.

alter table firms add column if not exists website text;


-- ============================================================================
-- MIGRATION: 0011_realtime.sql
-- ============================================================================
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


-- ============================================================================
-- MIGRATION: 0012_assistant_placement.sql
-- ============================================================================
-- Where each user wants the AI assistant button: in the header, as a floating button, or hidden.
-- Stored on the account so the choice follows the user to any device. Null = the default (header).
-- Run after 0011_realtime.sql.

alter table app_users
  add column if not exists assistant_placement text
  check (assistant_placement in ('header', 'floating', 'hidden'));

-- app_users is column-locked: a signed-in user may change only the columns granted here (see 0009).
grant update (assistant_placement) on app_users to authenticated;


-- ============================================================================
-- MIGRATION: 0013_enterprise_crm_modules.sql
-- ============================================================================
-- Enterprise CRM & Operations Suite expansion (ApexCRM Showcase).
--
-- Adds four complete company management modules:
--   1. Hiring & ATS        (job_openings, job_candidates)
--   2. Projects & Tasks    (projects, project_tasks)
--   3. Time & Leave        (leave_requests, timesheets)
--   4. Expenses & Payroll  (expense_claims, payroll_runs)
--
-- Also expands `user_permissions.page` to support 'hiring', 'projects',
-- 'time_leave', and 'expenses', enables RLS with page-scoped policies,
-- adds Realtime publication support, and seeds showcase data.

-- ============================================================================
-- 0. EXPAND PAGE PERMISSIONS
-- ============================================================================

alter table user_permissions drop constraint if exists user_permissions_page_check;
alter table user_permissions add constraint user_permissions_page_check check (
  page in (
    'dashboard',
    'firms',
    'cities',
    'employees',
    'contracts',
    'offers',
    'invoices',
    'hiring',
    'projects',
    'time_leave',
    'expenses'
  )
);

insert into user_permissions (user_id, page, access)
select u.id, p.page, 'write'
from app_users u
cross join (values ('hiring'), ('projects'), ('time_leave'), ('expenses')) as p (page)
on conflict (user_id, page) do nothing;

update workspaces set name = 'ApexCRM Enterprise' where id = '00000000-0000-0000-0000-00000000d0a0';

-- ============================================================================
-- 1. HIRING & ATS
-- ============================================================================

create table if not exists job_openings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  department text not null check (char_length(btrim(department)) > 0),
  location text not null check (char_length(btrim(location)) > 0),
  employment_type employment_type not null default 'full_time',
  salary_range text,
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references job_openings (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) > 0),
  email text not null check (char_length(btrim(email)) > 0),
  phone text,
  stage text not null default 'applied' check (stage in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  rating int not null default 4 check (rating between 1 and 5),
  interview_date date,
  portfolio_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_candidates_job_id on job_candidates (job_id);
create index if not exists idx_job_candidates_stage on job_candidates (stage);

drop trigger if exists trg_job_openings_updated_at on job_openings;
create trigger trg_job_openings_updated_at
  before update on job_openings
  for each row execute function set_updated_at();

drop trigger if exists trg_job_candidates_updated_at on job_candidates;
create trigger trg_job_candidates_updated_at
  before update on job_candidates
  for each row execute function set_updated_at();

-- ============================================================================
-- 2. PROJECTS & TASKS
-- ============================================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  firm_id uuid references firms (id) on delete set null,
  client_name text,
  owner_name text not null check (char_length(btrim(owner_name)) > 0),
  status text not null default 'active' check (status in ('planning', 'active', 'on_hold', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  budget numeric(12,2) not null default 0,
  spent numeric(12,2) not null default 0,
  progress int not null default 0 check (progress between 0 and 100),
  start_date date,
  due_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  assignee_name text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  estimated_hours numeric(6,1) not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_firm_id on projects (firm_id);
create index if not exists idx_project_tasks_project_id on project_tasks (project_id);

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

drop trigger if exists trg_project_tasks_updated_at on project_tasks;
create trigger trg_project_tasks_updated_at
  before update on project_tasks
  for each row execute function set_updated_at();

-- ============================================================================
-- 3. TIME & LEAVE MANAGEMENT
-- ============================================================================

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null check (char_length(btrim(employee_name)) > 0),
  leave_type text not null default 'annual' check (leave_type in ('annual', 'sick', 'parental', 'unpaid', 'remote_work')),
  start_date date not null,
  end_date date not null,
  days_count int not null default 1 check (days_count >= 1),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null check (char_length(btrim(employee_name)) > 0),
  project_name text not null check (char_length(btrim(project_name)) > 0),
  work_date date not null default current_date,
  hours_logged numeric(5,2) not null check (hours_logged > 0 and hours_logged <= 24),
  billable boolean not null default true,
  status text not null default 'submitted' check (status in ('submitted', 'approved')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_leave_requests_status on leave_requests (status);
create index if not exists idx_timesheets_work_date on timesheets (work_date desc);

drop trigger if exists trg_leave_requests_updated_at on leave_requests;
create trigger trg_leave_requests_updated_at
  before update on leave_requests
  for each row execute function set_updated_at();

-- ============================================================================
-- 4. EXPENSES & PAYROLL
-- ============================================================================

create table if not exists expense_claims (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  employee_name text not null check (char_length(btrim(employee_name)) > 0),
  category text not null default 'software' check (category in ('software', 'travel', 'equipment', 'marketing', 'office', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EUR',
  expense_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'reimbursed', 'rejected')),
  receipt_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_label text not null check (char_length(btrim(period_label)) > 0),
  pay_date date not null,
  employee_count int not null default 1 check (employee_count >= 1),
  gross_total numeric(12,2) not null default 0,
  tax_deductions numeric(12,2) not null default 0,
  net_total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'processing', 'paid')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expense_claims_status on expense_claims (status);
create index if not exists idx_payroll_runs_pay_date on payroll_runs (pay_date desc);

drop trigger if exists trg_expense_claims_updated_at on expense_claims;
create trigger trg_expense_claims_updated_at
  before update on expense_claims
  for each row execute function set_updated_at();

drop trigger if exists trg_payroll_runs_updated_at on payroll_runs;
create trigger trg_payroll_runs_updated_at
  before update on payroll_runs
  for each row execute function set_updated_at();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table job_openings enable row level security;
alter table job_candidates enable row level security;
alter table projects enable row level security;
alter table project_tasks enable row level security;
alter table leave_requests enable row level security;
alter table timesheets enable row level security;
alter table expense_claims enable row level security;
alter table payroll_runs enable row level security;

-- Hiring & ATS
create policy "page access read job_openings" on job_openings
  for select to authenticated using (has_any_page_access(array['hiring', 'dashboard']));
create policy "page access insert job_openings" on job_openings
  for insert to authenticated with check (has_page_access('hiring', 'write'));
create policy "page access update job_openings" on job_openings
  for update to authenticated using (has_page_access('hiring', 'write')) with check (has_page_access('hiring', 'write'));
create policy "page access delete job_openings" on job_openings
  for delete to authenticated using (has_page_access('hiring', 'write'));

create policy "page access read job_candidates" on job_candidates
  for select to authenticated using (has_any_page_access(array['hiring', 'dashboard']));
create policy "page access insert job_candidates" on job_candidates
  for insert to authenticated with check (has_page_access('hiring', 'write'));
create policy "page access update job_candidates" on job_candidates
  for update to authenticated using (has_page_access('hiring', 'write')) with check (has_page_access('hiring', 'write'));
create policy "page access delete job_candidates" on job_candidates
  for delete to authenticated using (has_page_access('hiring', 'write'));

-- Projects & Tasks
create policy "page access read projects" on projects
  for select to authenticated using (has_any_page_access(array['projects', 'dashboard', 'time_leave']));
create policy "page access insert projects" on projects
  for insert to authenticated with check (has_page_access('projects', 'write'));
create policy "page access update projects" on projects
  for update to authenticated using (has_page_access('projects', 'write')) with check (has_page_access('projects', 'write'));
create policy "page access delete projects" on projects
  for delete to authenticated using (has_page_access('projects', 'write'));

create policy "page access read project_tasks" on project_tasks
  for select to authenticated using (has_any_page_access(array['projects', 'dashboard']));
create policy "page access insert project_tasks" on project_tasks
  for insert to authenticated with check (has_page_access('projects', 'write'));
create policy "page access update project_tasks" on project_tasks
  for update to authenticated using (has_page_access('projects', 'write')) with check (has_page_access('projects', 'write'));
create policy "page access delete project_tasks" on project_tasks
  for delete to authenticated using (has_page_access('projects', 'write'));

-- Time & Leave
create policy "page access read leave_requests" on leave_requests
  for select to authenticated using (has_any_page_access(array['time_leave', 'employees', 'dashboard']));
create policy "page access insert leave_requests" on leave_requests
  for insert to authenticated with check (has_page_access('time_leave', 'write'));
create policy "page access update leave_requests" on leave_requests
  for update to authenticated using (has_page_access('time_leave', 'write')) with check (has_page_access('time_leave', 'write'));
create policy "page access delete leave_requests" on leave_requests
  for delete to authenticated using (has_page_access('time_leave', 'write'));

create policy "page access read timesheets" on timesheets
  for select to authenticated using (has_any_page_access(array['time_leave', 'projects', 'dashboard']));
create policy "page access insert timesheets" on timesheets
  for insert to authenticated with check (has_page_access('time_leave', 'write'));
create policy "page access update timesheets" on timesheets
  for update to authenticated using (has_page_access('time_leave', 'write')) with check (has_page_access('time_leave', 'write'));
create policy "page access delete timesheets" on timesheets
  for delete to authenticated using (has_page_access('time_leave', 'write'));

-- Expenses & Payroll
create policy "page access read expense_claims" on expense_claims
  for select to authenticated using (has_any_page_access(array['expenses', 'dashboard']));
create policy "page access insert expense_claims" on expense_claims
  for insert to authenticated with check (has_page_access('expenses', 'write'));
create policy "page access update expense_claims" on expense_claims
  for update to authenticated using (has_page_access('expenses', 'write')) with check (has_page_access('expenses', 'write'));
create policy "page access delete expense_claims" on expense_claims
  for delete to authenticated using (has_page_access('expenses', 'write'));

create policy "page access read payroll_runs" on payroll_runs
  for select to authenticated using (has_any_page_access(array['expenses', 'dashboard']));
create policy "page access insert payroll_runs" on payroll_runs
  for insert to authenticated with check (has_page_access('expenses', 'write'));
create policy "page access update payroll_runs" on payroll_runs
  for update to authenticated using (has_page_access('expenses', 'write')) with check (has_page_access('expenses', 'write'));
create policy "page access delete payroll_runs" on payroll_runs
  for delete to authenticated using (has_page_access('expenses', 'write'));

-- ============================================================================
-- 6. SEED SHOWCASE DATA FOR THE 4 NEW MODULES
-- ============================================================================

insert into job_openings (id, title, department, location, employment_type, salary_range, status, description)
values
  ('11111111-1111-4111-8111-111111111101', 'Senior Full-Stack Engineer (Next.js / TypeScript)', 'Engineering', 'Berlin, Germany (Hybrid)', 'full_time', '78.000 â‚¬ â€“ 92.000 â‚¬ / year', 'open', 'Lead architecture and delivery of enterprise client portals and CRM integrations.'),
  ('11111111-1111-4111-8111-111111111102', 'Enterprise Account Executive (DACH)', 'Sales & Growth', 'Munich, Germany', 'full_time', '70.000 â‚¬ â€“ 85.000 â‚¬ + OTE', 'open', 'Drive outbound expansion across mid-market and enterprise accounts in Germany, Austria, and Switzerland.'),
  ('11111111-1111-4111-8111-111111111103', 'Product Designer (Design Systems)', 'Product & Design', 'Remote (EU)', 'full_time', '64.000 â‚¬ â€“ 76.000 â‚¬ / year', 'open', 'Own the ApexCRM component library, dark/light design tokens, and enterprise workflow UX.'),
  ('11111111-1111-4111-8111-111111111104', 'DevOps & Cloud Security Specialist', 'Engineering', 'Frankfurt, Germany', 'contract', '6.800 â‚¬ / month', 'paused', 'SOC-2 / ISO-27001 automation, Kubernetes cluster hardening, and CI/CD observability.')
on conflict (id) do nothing;

insert into job_candidates (id, job_id, full_name, email, phone, stage, rating, interview_date, portfolio_url, notes)
values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'Lukas Weber', 'lukas.weber@example.de', '+49 170 4429182', 'interview', 5, '2026-11-26', 'https://github.com/lukasweber-dev', 'Strong system design round; built multi-tenant SaaS on Supabase + Next.js.'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101', 'Elena Rostova', 'elena.rostova@example.com', '+49 151 8923410', 'offer', 5, '2026-11-20', 'https://elenarostova.dev', 'Final technical & culture fit cleared. Offer sent for 15 Dec start.'),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111102', 'Maximilian Braun', 'm.braun@example.de', '+49 160 9981201', 'screening', 4, '2026-11-28', 'https://linkedin.com/in/maxbraun', '6 years B2B SaaS outbound experience across DACH legal & industrial sectors.'),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111103', 'Sofia Lindqvist', 'sofia.lindqvist@example.se', '+46 70 812 94 31', 'interview', 5, '2026-11-25', 'https://sofialindqvist.design', 'Exceptional Figma token architecture and B2B dashboard portfolio.'),
  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111102', 'Jonas Hartmann', 'jonas.hartmann@example.at', '+43 664 3819201', 'hired', 5, '2026-11-14', null, 'Signed employment agreement; onboarding scheduled for December 1.'),
  ('22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111101', 'Mateo Rossi', 'mateo.rossi@example.it', '+39 347 9012831', 'applied', 3, null, 'https://mateorossi.io', 'Solid frontend skills; awaiting take-home architecture review.')
on conflict (id) do nothing;

insert into projects (id, name, client_name, owner_name, status, priority, budget, spent, progress, start_date, due_date, description)
values
  ('33333333-3333-4333-8333-333333333301', 'Nordic Logistics ERP Modernization', 'Gamma Logistik GmbH', 'Sara Malik', 'active', 'critical', 48500.00, 31200.00, 68, '2026-09-15', '2026-12-20', 'End-to-end fleet dispatch portal, automated customs invoicing, and real-time warehouse telemetry.'),
  ('33333333-3333-4333-8333-333333333302', 'Innokem Chemical Compliance Portal', 'Innokem Oy', 'Omer Farooq', 'active', 'high', 32000.00, 14800.00, 46, '2026-10-10', '2027-01-15', 'REACH regulatory document automation, batch traceability, and distributor self-service hub.'),
  ('33333333-3333-4333-8333-333333333303', 'Alpine Legal Client Intake & DMS', 'Kanzlei Alpenblick AG', 'Sara Malik', 'planning', 'medium', 24000.00, 3500.00, 15, '2026-11-15', '2027-02-28', 'Encrypted client onboarding, automated engagement letters, and court deadline calendar sync.'),
  ('33333333-3333-4333-8333-333333333304', 'Benelux Supply Chain Analytics', 'Van Der Berg Transport BV', 'Omer Farooq', 'completed', 'high', 29500.00, 28900.00, 100, '2026-06-01', '2026-10-30', 'Executive BI dashboard with route margin analysis and predictive maintenance alerts.')
on conflict (id) do nothing;

insert into project_tasks (id, project_id, title, assignee_name, status, priority, due_date, estimated_hours)
values
  ('44444444-4444-4444-8444-444444444401', '33333333-3333-4333-8333-333333333301', 'Finalize SAP webhook sync for customs manifests', 'Sara Malik', 'in_progress', 'high', '2026-11-27', 16),
  ('44444444-4444-4444-8444-444444444402', '33333333-3333-4333-8333-333333333301', 'Role-based access audit for regional dispatchers', 'Omer Farooq', 'review', 'high', '2026-11-24', 8),
  ('44444444-4444-4444-8444-444444444403', '33333333-3333-4333-8333-333333333302', 'Build multi-language safety datasheet PDF generator', 'Lukas Weber', 'in_progress', 'medium', '2026-12-03', 20),
  ('44444444-4444-4444-8444-444444444404', '33333333-3333-4333-8333-333333333302', 'Migrate historical batch certificates to Supabase Storage', 'Sara Malik', 'done', 'medium', '2026-11-18', 12),
  ('44444444-4444-4444-8444-444444444405', '33333333-3333-4333-8333-333333333303', 'Interactive wireframe sign-off with managing partners', 'Sofia Lindqvist', 'todo', 'medium', '2026-12-01', 10),
  ('44444444-4444-4444-8444-444444444406', '33333333-3333-4333-8333-333333333304', 'Production handover & SLA runbook delivery', 'Omer Farooq', 'done', 'high', '2026-10-28', 6)
on conflict (id) do nothing;

insert into leave_requests (id, employee_name, leave_type, start_date, end_date, days_count, status, reason, reviewer_note)
values
  ('55555555-5555-4555-8555-555555555501', 'Lukas Weber', 'annual', '2026-12-21', '2026-12-31', 8, 'pending', 'Year-end family holiday in Bavaria', null),
  ('55555555-5555-4555-8555-555555555502', 'Sofia Lindqvist', 'remote_work', '2026-11-30', '2026-12-04', 5, 'approved', 'Working remotely from Stockholm design studio', 'Approved â€” overlaps with EU CET core hours'),
  ('55555555-5555-4555-8555-555555555503', 'Jonas Hartmann', 'annual', '2026-12-10', '2026-12-11', 2, 'approved', 'Moving apartment in Vienna', 'Approved'),
  ('55555555-5555-4555-8555-555555555504', 'Elena Rostova', 'sick', '2026-11-18', '2026-11-19', 2, 'approved', 'Seasonal flu recovery', 'Get well soon')
on conflict (id) do nothing;

insert into timesheets (id, employee_name, project_name, work_date, hours_logged, billable, status, notes)
values
  ('66666666-6666-4666-8666-666666666601', 'Sara Malik', 'Nordic Logistics ERP Modernization', '2026-11-22', 7.5, true, 'approved', 'Implemented customs webhook retry queue and dead-letter alerts.'),
  ('66666666-6666-4666-8666-666666666602', 'Omer Farooq', 'Innokem Chemical Compliance Portal', '2026-11-22', 6.5, true, 'approved', 'Client sprint review + REACH substance classification schema.'),
  ('66666666-6666-4666-8666-666666666603', 'Lukas Weber', 'Nordic Logistics ERP Modernization', '2026-11-21', 8.0, true, 'submitted', 'Fleet telemetry WebSocket streaming optimization.'),
  ('66666666-6666-4666-8666-666666666604', 'Sofia Lindqvist', 'Alpine Legal Client Intake & DMS', '2026-11-21', 5.5, true, 'submitted', 'High-contrast legal document previewer & signature flow.'),
  ('66666666-6666-4666-8666-666666666605', 'Sara Malik', 'Internal Platform Architecture', '2026-11-20', 3.0, false, 'approved', 'Engineering interviews and Q4 roadmap planning.')
on conflict (id) do nothing;

insert into expense_claims (id, title, employee_name, category, amount, currency, expense_date, status, receipt_ref, notes)
values
  ('77777777-7777-4777-8777-777777777701', 'Vercel Pro & Supabase Enterprise Compute (Nov)', 'Sara Malik', 'software', 420.00, 'EUR', '2026-11-18', 'reimbursed', 'INV-VCL-2026-11', 'Monthly production cloud infrastructure and edge network.'),
  ('77777777-7777-4777-8777-777777777702', 'ICE Rail & Hotel â€” Munich Enterprise Client Summit', 'Omer Farooq', 'travel', 685.50, 'EUR', '2026-11-19', 'approved', 'DB-99412-MUC', 'On-site contract workshop with DACH enterprise prospects.'),
  ('77777777-7777-4777-8777-777777777703', 'Apple Studio Display for Design Workstation', 'Sofia Lindqvist', 'equipment', 1749.00, 'EUR', '2026-11-21', 'pending', 'APL-DE-88310', 'Home-office hardware allowance for newly onboarded lead designer.'),
  ('77777777-7777-4777-8777-777777777704', 'LinkedIn Sales Navigator & DACH Lead Enrichment', 'Maximilian Braun', 'marketing', 310.00, 'EUR', '2026-11-15', 'reimbursed', 'LI-882410', 'Monthly outbound prospecting seat licenses.')
on conflict (id) do nothing;

insert into payroll_runs (id, period_label, pay_date, employee_count, gross_total, tax_deductions, net_total, status, notes)
values
  ('88888888-8888-4888-8888-888888888801', 'November 2026', '2026-11-28', 9, 46800.00, 14976.00, 31824.00, 'processing', 'Includes Q4 performance bonus for outbound sales & engineering leads.'),
  ('88888888-8888-4888-8888-888888888802', 'October 2026', '2026-10-30', 8, 42400.00, 13568.00, 28832.00, 'paid', 'SEPA batch disbursement completed via Deutsche Bank.'),
  ('88888888-8888-4888-8888-888888888803', 'September 2026', '2026-09-30', 8, 42400.00, 13568.00, 28832.00, 'paid', 'SEPA batch disbursement completed via Deutsche Bank.')
on conflict (id) do nothing;

-- ============================================================================
-- 7. REALTIME PUBLICATION
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'job_openings',
    'job_candidates',
    'projects',
    'project_tasks',
    'leave_requests',
    'timesheets',
    'expense_claims',
    'payroll_runs'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- 8. SAMPLE SHOWCASE LOGINS (demo@apexcrm.io & team@apexcrm.io)
-- ============================================================================

do $$
declare
  workspace_uuid uuid := '00000000-0000-0000-0000-00000000d0a0';
  admin_uid      uuid;
  team_uid       uuid;
  emp_uid        uuid;
begin
  select id into admin_uid from auth.users where lower(email) = 'demo@apexcrm.io';
  if admin_uid is null then
    admin_uid := '99999999-9999-4999-8999-999999999901';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_uid, 'authenticated', 'authenticated',
      'demo@apexcrm.io', extensions.crypt('ApexDemo2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Alex Vance'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_uid, admin_uid::text, 'email',
      jsonb_build_object('sub', admin_uid::text, 'email', 'demo@apexcrm.io', 'email_verified', true),
      now(), now(), now()
    );
  end if;

  update app_users
  set account_role = 'user'
  where workspace_id = workspace_uuid and account_role = 'admin' and id <> admin_uid;

  insert into app_users (id, full_name, role, workspace_id, account_role, is_active)
  values (admin_uid, 'Alex Vance', 'VP of Operations', workspace_uuid, 'admin', true)
  on conflict (id) do update
    set full_name    = excluded.full_name,
        role         = excluded.role,
        workspace_id = excluded.workspace_id,
        account_role = 'admin',
        is_active    = true;

  select id into team_uid from auth.users where lower(email) = 'team@apexcrm.io';
  if team_uid is null then
    team_uid := '99999999-9999-4999-8999-999999999902';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', team_uid, 'authenticated', 'authenticated',
      'team@apexcrm.io', extensions.crypt('ApexTeam2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Maya Lin'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), team_uid, team_uid::text, 'email',
      jsonb_build_object('sub', team_uid::text, 'email', 'team@apexcrm.io', 'email_verified', true),
      now(), now(), now()
    );
  end if;

  insert into app_users (id, full_name, role, workspace_id, account_role, is_active)
  values (team_uid, 'Maya Lin', 'Operations Manager', workspace_uuid, 'user', true)
  on conflict (id) do update
    set full_name    = excluded.full_name,
        role         = excluded.role,
        workspace_id = excluded.workspace_id,
        account_role = 'user',
        is_active    = true;

  insert into user_permissions (user_id, page, access)
  select team_uid, p.page, 'write'
  from (
    values
      ('dashboard'), ('firms'), ('cities'), ('employees'), ('contracts'),
      ('offers'), ('invoices'), ('hiring'), ('projects'), ('time_leave'), ('expenses')
  ) as p (page)
  on conflict (user_id, page) do update set access = 'write';

  select id into emp_uid from auth.users where lower(email) = 'employee@apexcrm.io';
  if emp_uid is null then
    emp_uid := '99999999-9999-4999-8999-999999999903';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', emp_uid, 'authenticated', 'authenticated',
      'employee@apexcrm.io', extensions.crypt('ApexStaff2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Lukas Weber'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), emp_uid, emp_uid::text, 'email',
      jsonb_build_object('sub', emp_uid::text, 'email', 'employee@apexcrm.io', 'email_verified', true),
      now(), now(), now()
    );
  end if;

  insert into app_users (id, full_name, role, workspace_id, account_role, is_active)
  values (emp_uid, 'Lukas Weber', 'Senior Full-Stack Engineer', workspace_uuid, 'user', true)
  on conflict (id) do update
    set full_name    = excluded.full_name,
        role         = excluded.role,
        workspace_id = excluded.workspace_id,
        account_role = 'user',
        is_active    = true;

  delete from user_permissions where user_id = emp_uid;
  insert into user_permissions (user_id, page, access)
  select emp_uid, p.page, 'write'
  from (values ('time_leave'), ('projects'), ('expenses')) as p (page)
  on conflict (user_id, page) do update set access = 'write';
end $$;


-- ============================================================================
-- 9. SEED REAL CRM & OUTBOUND DATA INTO NEW SAMPLE DATABASE
-- ============================================================================

insert into firms (id, name, country, state, city, status, website, contact_name, contact_email, contact_phone, notes)
values
  ('f0000000-0000-4000-8000-000000000101', 'Nordic Systems & Logistics AB', 'Germany', 'Berlin', 'Berlin', 'client', 'https://nordicsystems.de', 'Dr. Henrik Lindholm', 'h.lindholm@nordicsystems.de', '+49 30 9821400', 'Signed annual enterprise SLA (48.500 €). Fleet telemetry & ERP integration active.'),
  ('f0000000-0000-4000-8000-000000000102', 'Bavaria Cloud Industrial GmbH', 'Germany', 'Bavaria', 'Munich', 'client', 'https://bavariacloud.de', 'Katharina Falk', 'k.falk@bavariacloud.de', '+49 89 4412980', 'Multi-site manufacturing portal deployed across 4 Bavarian plants.'),
  ('f0000000-0000-4000-8000-000000000103', 'Hanseatic Maritime Freight AG', 'Germany', 'Hamburg', 'Hamburg', 'client', 'https://hanseatic-freight.de', 'Marcus von Berg', 'm.vonberg@hanseatic-freight.de', '+49 40 7781209', 'Container customs manifest automation & real-time port dispatch.'),
  ('f0000000-0000-4000-8000-000000000104', 'RheinMain FinTech & Advisory Partners', 'Germany', 'Hesse', 'Frankfurt am Main', 'negotiation', 'https://rheinmain-advisory.de', 'Dr. Stefan Meister', 's.meister@rheinmain-advisory.de', '+49 69 3319022', 'Reviewing 36.000 € commercial proposal; final legal redline call on Thursday.'),
  ('f0000000-0000-4000-8000-000000000105', 'Stuttgart Precision Robotics GmbH', 'Germany', 'Baden-Württemberg', 'Stuttgart', 'client', 'https://stuttgart-robotics.de', 'Anja Reinhardt', 'reinhardt@stuttgart-robotics.de', '+49 711 8902310', 'Phase 2 predictive maintenance dashboard contracted for Q1.'),
  ('f0000000-0000-4000-8000-000000000106', 'Rheinland Legal & Tax Kanzlei', 'Germany', 'North Rhine-Westphalia', 'Cologne', 'negotiation', 'https://rheinland-kanzlei.de', 'Christian Becker', 'c.becker@rheinland-kanzlei.de', '+49 221 6509110', 'Requested custom DMS & DATEV export module in offer A-2026-0018.'),
  ('f0000000-0000-4000-8000-000000000107', 'Düsseldorf MedTech Solutions GmbH', 'Germany', 'North Rhine-Westphalia', 'Düsseldorf', 'responded', 'https://medtech-duesseldorf.de', 'Dr. Julia Kramer', 'j.kramer@medtech-duesseldorf.de', '+49 211 9081244', 'Positive reply from VP Engineering; discovery demo booked for next Tuesday.'),
  ('f0000000-0000-4000-8000-000000000108', 'Saxony Energy Grid & Renewables AG', 'Germany', 'Saxony', 'Leipzig', 'client', 'https://saxony-grid.de', 'Tobias Hartmann', 't.hartmann@saxony-grid.de', '+49 341 5520190', 'Smart-meter customer portal live with 14.000 commercial endpoints.'),
  ('f0000000-0000-4000-8000-000000000109', 'Franconia Auto Components GmbH', 'Germany', 'Bavaria', 'Nuremberg', 'responded', 'https://franconia-auto.de', 'Matthias Scholz', 'm.scholz@franconia-auto.de', '+49 911 4409821', 'Interested in supplier quality tracking & automated RFQ workflows.'),
  ('f0000000-0000-4000-8000-000000000110', 'Lower Saxony Agritech Logistics', 'Germany', 'Lower Saxony', 'Hanover', 'sent', 'https://agritech-hanover.de', 'Sabine Voigt', 's.voigt@agritech-hanover.de', '+49 511 8823104', 'Executive intro deck & case study sent; follow-up scheduled in 4 days.'),
  ('f0000000-0000-4000-8000-000000000111', 'Elbe Silicon Microelectronics GmbH', 'Germany', 'Saxony', 'Dresden', 'in_progress', 'https://elbesilicon.de', 'Dr. Lars Neumann', 'l.neumann@elbesilicon.de', '+49 351 7741200', 'Multi-channel LinkedIn & email cadence step 2 of 4 active.'),
  ('f0000000-0000-4000-8000-000000000112', 'Weser Port Terminal Operations', 'Germany', 'Bremen', 'Bremen', 'client', 'https://weser-terminal.de', 'Jan-Philipp Kruse', 'kruse@weser-terminal.de', '+49 421 6612098', 'Onboarded for vessel berth scheduling and customs invoicing.'),
  ('f0000000-0000-4000-8000-000000000113', 'Alpenblick Corporate Law & Notary AG', 'Austria', 'Vienna', 'Vienna', 'client', 'https://alpenblick-law.at', 'Mag. Lukas Gruber', 'l.gruber@alpenblick-law.at', '+43 1 5129080', 'Client intake portal and encrypted document vault active.'),
  ('f0000000-0000-4000-8000-000000000114', 'Salzburg Alpine Hospitality Group', 'Austria', 'Salzburg', 'Salzburg', 'negotiation', 'https://alpine-hospitality.at', 'Hannah Moser', 'h.moser@alpine-hospitality.at', '+43 662 871204', 'Scoping multi-property booking & staff rostering CRM.'),
  ('f0000000-0000-4000-8000-000000000115', 'Van Der Berg EuroTransport BV', 'Netherlands', 'North Holland', 'Amsterdam', 'client', 'https://vanderberg-transport.nl', 'Pieter van der Berg', 'pieter@vanderberg-transport.nl', '+31 20 7940120', 'Delivered Benelux supply chain analytics & margin tracker.'),
  ('f0000000-0000-4000-8000-000000000116', 'Rotterdam EuroPort Logistics NV', 'Netherlands', 'South Holland', 'Rotterdam', 'responded', 'https://europort-logistics.nl', 'Sanne de Vries', 's.devries@europort-logistics.nl', '+31 10 8821900', 'Technical architecture review scheduled with CTO next Monday.'),
  ('f0000000-0000-4000-8000-000000000117', 'Innokem Specialty Chemicals Oy', 'Finland', 'Uusimaa', 'Helsinki', 'client', 'https://innokem.fi', 'Mikko Virtanen', 'mikko.virtanen@innokem.fi', '+358 9 42450110', 'REACH chemical compliance portal active; 32.000 € contract.'),
  ('f0000000-0000-4000-8000-000000000118', 'Krona FinTech & Payments AB', 'Sweden', 'Stockholm', 'Stockholm', 'client', 'https://kronapayments.se', 'Astrid Lindberg', 'astrid@kronapayments.se', '+46 8 50129400', 'Automated KYC onboarding & compliance reporting suite live.')
on conflict (id) do nothing;

insert into city_completion (country, state, city, manual_status, note)
values
  ('Germany', 'Berlin', 'Berlin', 'completed', 'Full tier-1 enterprise & legal directory outreach completed.'),
  ('Germany', 'Bavaria', 'Munich', 'completed', 'All industrial, SaaS & legal chambers covered.'),
  ('Germany', 'Hamburg', 'Hamburg', 'completed', 'Maritime, logistics & port freight directory 100% contacted.'),
  ('Germany', 'Hesse', 'Frankfurt am Main', 'completed', 'Banking, fintech & corporate advisory firms completed.'),
  ('Germany', 'Baden-Württemberg', 'Stuttgart', 'completed', 'Automotive & precision engineering cluster completed.'),
  ('Germany', 'North Rhine-Westphalia', 'Cologne', 'completed', 'Media, insurance & commercial law register completed.'),
  ('Germany', 'North Rhine-Westphalia', 'Düsseldorf', 'completed', 'NRW headquarters & medtech corridor completed.'),
  ('Germany', 'Saxony', 'Leipzig', 'completed', 'Energy & logistics hub outreach finalized.'),
  ('Germany', 'Bavaria', 'Nuremberg', 'completed', 'Franconia manufacturing list completed.'),
  ('Germany', 'Bremen', 'Bremen', 'completed', 'Shipping & aerospace suppliers completed.'),
  ('Austria', 'Vienna', 'Vienna', 'completed', 'DACH enterprise expansion wave 1 completed.'),
  ('Austria', 'Salzburg', 'Salzburg', 'completed', 'Hospitality & cross-border logistics completed.'),
  ('Netherlands', 'North Holland', 'Amsterdam', 'completed', 'Benelux headquarters & fintech outreach completed.'),
  ('Netherlands', 'South Holland', 'Rotterdam', 'completed', 'Europort maritime & freight forwarders completed.'),
  ('Finland', 'Uusimaa', 'Helsinki', 'completed', 'Industrial & chemical compliance campaign completed.'),
  ('Sweden', 'Stockholm', 'Stockholm', 'completed', 'Nordic SaaS & fintech tier-1 accounts completed.')
on conflict (country, state, city) do update
  set manual_status = excluded.manual_status,
      note = excluded.note;

insert into employees (id, full_name, country, position, email, phone, employment_type, contract_start_date, salary_amount, salary_period, has_contract)
values
  ('e0000000-0000-4000-8000-000000000101', 'Alex Vance', 'Germany', 'VP of Operations', 'demo@apexcrm.io', '+49 170 2109482', 'full_time', '2024-03-01', 9200, 'month', true),
  ('e0000000-0000-4000-8000-000000000102', 'Maya Lin', 'Germany', 'Project & Delivery Lead', 'team@apexcrm.io', '+49 171 5592014', 'full_time', '2024-06-15', 7800, 'month', true),
  ('e0000000-0000-4000-8000-000000000103', 'Lukas Weber', 'Germany', 'Senior Full-Stack Engineer', 'employee@apexcrm.io', '+49 170 4429182', 'full_time', '2025-03-01', 7200, 'month', true),
  ('e0000000-0000-4000-8000-000000000104', 'Sofia Lindqvist', 'Sweden', 'Staff Product Designer', 'sofia.lindqvist@apexcrm.io', '+46 70 812 94 31', 'full_time', '2025-08-01', 6400, 'month', true),
  ('e0000000-0000-4000-8000-000000000105', 'Jonas Hartmann', 'Austria', 'Enterprise Account Executive', 'jonas.hartmann@apexcrm.io', '+43 664 3819201', 'full_time', '2026-11-01', 6900, 'month', false)
on conflict (id) do nothing;

insert into contracts (id, employee_id, status, data)
values
  ('c0000000-0000-4000-8000-000000000101', 'e0000000-0000-4000-8000-000000000101', 'final', '{"position":"VP of Operations","start_date":"2024-03-01","salary_amount":9200,"salary_period":"month","salary":"9.200,00 € / month"}'::jsonb),
  ('c0000000-0000-4000-8000-000000000102', 'e0000000-0000-4000-8000-000000000102', 'final', '{"position":"Project & Delivery Lead","start_date":"2024-06-15","salary_amount":7800,"salary_period":"month","salary":"7.800,00 € / month"}'::jsonb),
  ('c0000000-0000-4000-8000-000000000103', 'e0000000-0000-4000-8000-000000000103', 'final', '{"position":"Senior Full-Stack Engineer","start_date":"2025-03-01","salary_amount":7200,"salary_period":"month","salary":"7.200,00 € / month"}'::jsonb),
  ('c0000000-0000-4000-8000-000000000104', 'e0000000-0000-4000-8000-000000000104', 'final', '{"position":"Staff Product Designer","start_date":"2025-08-01","salary_amount":6400,"salary_period":"month","salary":"6.400,00 € / month"}'::jsonb)
on conflict (id) do nothing;

insert into angebots (id, angebot_number, firm_id, issue_date, valid_until, line_items, vat_rate, net_amount, vat_amount, total_amount, status)
values
  ('a0000000-0000-4000-8000-000000000101', 'A-2026-0001', 'f0000000-0000-4000-8000-000000000101', '2026-10-01', '2026-10-31', '[{"description":"Enterprise ERP & Fleet Telemetry Platform","quantity":"1 pauschal","unit_price":40756.30,"total":40756.30}]'::jsonb, 19, 40756.30, 7743.70, 48500.00, 'accepted'),
  ('a0000000-0000-4000-8000-000000000102', 'A-2026-0002', 'f0000000-0000-4000-8000-000000000117', '2026-10-08', '2026-11-08', '[{"description":"REACH Chemical Compliance Portal","quantity":"1 pauschal","unit_price":26890.76,"total":26890.76}]'::jsonb, 19, 26890.76, 5109.24, 32000.00, 'accepted'),
  ('a0000000-0000-4000-8000-000000000103', 'A-2026-0003', 'f0000000-0000-4000-8000-000000000104', '2026-11-12', '2026-12-12', '[{"description":"FinTech Advisory Client Portal & KYC Sync","quantity":"1 pauschal","unit_price":30252.10,"total":30252.10}]'::jsonb, 19, 30252.10, 5747.90, 36000.00, 'sent'),
  ('a0000000-0000-4000-8000-000000000104', 'A-2026-0004', 'f0000000-0000-4000-8000-000000000106', '2026-11-18', '2026-12-18', '[{"description":"Custom Legal DMS & DATEV Integration","quantity":"1 pauschal","unit_price":20168.07,"total":20168.07}]'::jsonb, 19, 20168.07, 3831.93, 24000.00, 'sent')
on conflict (id) do nothing;

insert into invoices (id, invoice_number, firm_id, angebot_id, issue_date, due_date, service_period_start, service_period_end, line_items, vat_rate, net_amount, vat_amount, total_amount, status)
values
  ('b0000000-0000-4000-8000-000000000101', 'R-2026-0001', 'f0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000101', '2026-10-15', '2026-10-29', '2026-10-01', '2026-10-31', '[{"description":"Milestone 1: Core Telemetry & Auth","quantity":"1 pauschal","unit_price":20378.15,"total":20378.15}]'::jsonb, 19, 20378.15, 3871.85, 24250.00, 'paid'),
  ('b0000000-0000-4000-8000-000000000102', 'R-2026-0002', 'f0000000-0000-4000-8000-000000000117', 'a0000000-0000-4000-8000-000000000102', '2026-11-01', '2026-11-15', '2026-10-10', '2026-11-10', '[{"description":"Milestone 1: REACH Schema & Storage","quantity":"1 pauschal","unit_price":13445.38,"total":13445.38}]'::jsonb, 19, 13445.38, 2554.62, 16000.00, 'paid'),
  ('b0000000-0000-4000-8000-000000000103', 'R-2026-0003', 'f0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000101', '2026-11-15', '2026-11-29', '2026-11-01', '2026-11-30', '[{"description":"Milestone 2: SAP Webhook & Invoicing","quantity":"1 pauschal","unit_price":20378.15,"total":20378.15}]'::jsonb, 19, 20378.15, 3871.85, 24250.00, 'sent')
on conflict (id) do nothing;

insert into dashboard_daily_snapshot (snapshot_date, total_firms, sent_count, responded_count, negotiation_count, client_count, in_progress_count, cities_completed, cities_total)
values
  ('2026-10-23', 12, 1, 2, 2, 5, 2, 10, 142),
  ('2026-10-30', 14, 1, 2, 2, 6, 3, 12, 142),
  ('2026-11-07', 16, 1, 3, 3, 7, 2, 14, 142),
  ('2026-11-15', 17, 1, 3, 3, 8, 2, 15, 142),
  ('2026-11-22', 18, 1, 3, 3, 10, 1, 16, 142)
on conflict (snapshot_date) do nothing;
