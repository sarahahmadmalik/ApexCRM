-- ============================================================================
-- Dua Dev internal tool — COMPLETE DATABASE SCHEMA (safe to re-run)
-- ============================================================================
--
-- Paste this whole file into the Supabase SQL editor and run it. It works on:
--   * a brand-new project,
--   * a project with an older version of the schema (any state), and
--   * a project that is already up to date — running it again changes nothing.
--
-- It never fails because something "already exists": tables are created only if
-- missing, missing columns are added to existing tables, enum values are renamed
-- or converted in place, and functions / views / triggers / policies are replaced
-- with their current definitions. Existing rows are kept.
--
-- What it converts on an existing database
--   * firm status  'interested'          -> 'negotiation'
--   * offer status 'signed' / 'expired'  -> 'accepted' / 'rejected'
--   * dashboard snapshot 'interested_count' -> 'negotiation_count' (+ 'in_progress_count')
--   * app_users gets workspace / account role / active flag; company role is free text
--   * firms.website, employee employment type / contract dates / salary are added
--   * per-page permissions: users that exist the FIRST time this runs keep access to
--     every page (so nobody is locked out); after that, permissions are never touched.
--
-- After it has run, make yourself admin:
--   supabase/scripts/create_admin_saramalik.sql   (or supabase/seed.sql on a blank project)
--
-- supabase/migrations/ holds the same changes as separate numbered steps (for
-- `supabase db push`). tests/db checks that this file and the migrations end up identical.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'firm_status') then
    create type firm_status as enum (
      'not_started',   -- no outreach yet
      'in_progress',   -- currently sending / working on this firm
      'sent',          -- proposal email sent
      'responded',     -- firm replied
      'negotiation',   -- firm is close to becoming a client (negotiating)
      'client'         -- firm has become a client
    );
  elsif exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'firm_status' and e.enumlabel = 'interested'
  ) and not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'firm_status' and e.enumlabel = 'negotiation'
  ) then
    alter type firm_status rename value 'interested' to 'negotiation';
  end if;

  if not exists (select 1 from pg_type where typname = 'city_manual_status') then
    create type city_manual_status as enum ('not_started', 'in_progress', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'contract_status') then
    create type contract_status as enum ('draft', 'final');
  end if;

  if not exists (select 1 from pg_type where typname = 'employment_type') then
    create type employment_type as enum ('full_time', 'part_time', 'contract');
  end if;

  if not exists (select 1 from pg_type where typname = 'angebot_status') then
    create type angebot_status as enum ('draft', 'sent', 'accepted', 'rejected');
  end if;
end $$;

-- Offer statuses used to be draft / sent / signed / rejected / expired. Convert an
-- old type in place: signed -> accepted, expired -> rejected.
do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'angebot_status' and e.enumlabel in ('signed', 'expired')
  ) then
    alter type angebot_status rename to angebot_status_old;
    create type angebot_status as enum ('draft', 'sent', 'accepted', 'rejected');

    if to_regclass('public.angebots') is not null then
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
    end if;

    drop type angebot_status_old;
  end if;
end $$;

-- ============================================================================
-- WORKSPACES
-- ============================================================================

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

-- The default workspace. Renaming it later is kept (this only inserts if missing).
insert into workspaces (id, name)
values ('00000000-0000-0000-0000-00000000d0a0', 'Dua Dev')
on conflict (id) do nothing;

-- ============================================================================
-- APP USERS (everyone allowed into the tool; managed by the workspace admin)
-- ============================================================================

create table if not exists app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null,                                   -- company position, free text (CTO, Designer, ...)
  created_at timestamptz not null default now()
);

alter table app_users add column if not exists theme_preference text;
alter table app_users add column if not exists assistant_placement text;
alter table app_users add column if not exists workspace_id uuid references workspaces (id);
alter table app_users add column if not exists account_role text not null default 'user';
alter table app_users add column if not exists is_active boolean not null default true;

-- Value checks, added separately so they also land on columns that already existed without them.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_users_theme_preference_check' and conrelid = 'app_users'::regclass) then
    alter table app_users add constraint app_users_theme_preference_check check (theme_preference in ('light', 'dark', 'system'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_users_assistant_placement_check' and conrelid = 'app_users'::regclass) then
    alter table app_users add constraint app_users_assistant_placement_check check (assistant_placement in ('header', 'floating', 'hidden'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_users_account_role_check' and conrelid = 'app_users'::regclass) then
    alter table app_users add constraint app_users_account_role_check check (account_role in ('admin', 'user'));
  end if;
end $$;

update app_users set workspace_id = '00000000-0000-0000-0000-00000000d0a0' where workspace_id is null;
alter table app_users alter column workspace_id set not null;
-- Single default workspace for now: inserts that don't name one (seed scripts) land in it.
alter table app_users alter column workspace_id set default '00000000-0000-0000-0000-00000000d0a0';

-- `role` used to be limited to 'ceo' / 'cto'; it is the company position now.
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check check (char_length(btrim(role)) between 1 and 60);

comment on column app_users.role is 'Company position, free text (e.g. CTO). Not an access role — see account_role.';
comment on column app_users.account_role is 'Access role: admin (manages the workspace, full access) or user (page permissions apply).';

-- One admin per workspace is enough for now; the app never creates a second one.
create unique index if not exists app_users_one_admin_per_workspace on app_users (workspace_id) where account_role = 'admin';

-- ============================================================================
-- PAGE PERMISSIONS  (no row = no access; admins bypass this table)
-- ============================================================================

do $$
begin
  if to_regclass('public.user_permissions') is null then
    create table user_permissions (
      user_id uuid not null references app_users (id) on delete cascade,
      page text not null check (page in ('dashboard', 'firms', 'cities', 'employees', 'contracts', 'offers', 'invoices')),
      access text not null check (access in ('read', 'write')),
      primary key (user_id, page)
    );

    -- Only when the table is first created: everyone who could already use the tool keeps
    -- full read & write, so this upgrade locks nobody out. Never repeated on later runs,
    -- so it can't undo permissions the admin has set since.
    insert into user_permissions (user_id, page, access)
    select u.id, p.page, 'write'
    from app_users u
    cross join (values ('dashboard'), ('firms'), ('cities'), ('employees'), ('contracts'), ('offers'), ('invoices')) as p (page);
  end if;
end $$;

-- ============================================================================
-- ACCESS HELPERS (security definer, so RLS policies can call them without recursion)
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

-- p_level: 'read' (a read OR write grant satisfies it) or 'write' (write grant only). Admins pass every check.
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

-- True when the caller can read at least one of the pages — for tables that several pages display.
create or replace function has_any_page_access(p_pages text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from unnest(p_pages) as p where has_page_access(p, 'read'));
$$;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
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
  website text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_by uuid references app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table firms add column if not exists website text;
alter table firms add column if not exists contact_name text;
alter table firms add column if not exists contact_email text;
alter table firms add column if not exists contact_phone text;
alter table firms add column if not exists notes text;
alter table firms add column if not exists created_by uuid references app_users (id) on delete set null;
alter table firms add column if not exists created_at timestamptz not null default now();
alter table firms add column if not exists updated_at timestamptz not null default now();

create index if not exists firms_country_idx on firms (country);
create index if not exists firms_city_idx on firms (city);
create index if not exists firms_status_idx on firms (status);
create index if not exists firms_name_trgm_idx on firms using gin (to_tsvector('simple', name));

drop trigger if exists firms_set_updated_at on firms;
create trigger firms_set_updated_at
  before update on firms
  for each row execute function set_updated_at();

-- ============================================================================
-- CITY COMPLETION (manual status / notes per city)
-- ============================================================================

create table if not exists city_completion (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  state text not null,
  city text not null,
  manual_status city_manual_status,      -- null = use the auto-detected status
  note text,
  updated_at timestamptz not null default now(),
  unique (country, state, city)
);

alter table city_completion add column if not exists manual_status city_manual_status;
alter table city_completion add column if not exists note text;
alter table city_completion add column if not exists updated_at timestamptz not null default now();

-- Auto-detected status: 'not_started' when every firm in a city is untouched,
-- 'in_progress' the moment any firm has moved. Never 'completed' on its own —
-- the tool can't know a city's firm list is exhaustive.
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

-- Effective status = manual override if set, otherwise the auto-detected one.
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
-- EMPLOYEES + CONTRACTS
-- ============================================================================

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  country text,
  position text,
  email text,
  phone text,
  employment_type employment_type not null default 'full_time',
  contract_start_date date,
  contract_end_date date,
  salary_amount numeric(12, 2),
  salary_period text,
  has_contract boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table employees add column if not exists country text;
alter table employees add column if not exists position text;
alter table employees add column if not exists email text;
alter table employees add column if not exists phone text;
alter table employees add column if not exists employment_type employment_type not null default 'full_time';
alter table employees add column if not exists contract_start_date date;
alter table employees add column if not exists contract_end_date date;
alter table employees add column if not exists salary_amount numeric(12, 2);
alter table employees add column if not exists salary_period text;
alter table employees add column if not exists has_contract boolean not null default false;
alter table employees add column if not exists created_at timestamptz not null default now();
alter table employees add column if not exists updated_at timestamptz not null default now();

do $$
begin
  -- A fixed-term contract must run forwards.
  if not exists (select 1 from pg_constraint where conname = 'employees_contract_dates_valid' and conrelid = 'employees'::regclass) then
    alter table employees add constraint employees_contract_dates_valid
      check (contract_end_date is null or contract_start_date is null or contract_end_date >= contract_start_date);
  end if;
  -- Salary is either fully set (positive amount + month/year) or fully empty.
  if not exists (select 1 from pg_constraint where conname = 'employees_salary_valid' and conrelid = 'employees'::regclass) then
    alter table employees add constraint employees_salary_valid
      check (
        (salary_amount is null and salary_period is null)
        or (salary_amount > 0 and salary_period in ('month', 'year'))
      );
  end if;
end $$;

drop trigger if exists employees_set_updated_at on employees;
create trigger employees_set_updated_at
  before update on employees
  for each row execute function set_updated_at();

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  status contract_status not null default 'draft',
  data jsonb not null default '{}'::jsonb,   -- structured fields used to fill the contract template
  file_path text,                             -- storage path of the generated .docx/.pdf
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contracts add column if not exists status contract_status not null default 'draft';
alter table contracts add column if not exists data jsonb not null default '{}'::jsonb;
alter table contracts add column if not exists file_path text;
alter table contracts add column if not exists created_at timestamptz not null default now();
alter table contracts add column if not exists updated_at timestamptz not null default now();

drop trigger if exists contracts_set_updated_at on contracts;
create trigger contracts_set_updated_at
  before update on contracts
  for each row execute function set_updated_at();

-- Keeps employees.has_contract in sync. Security definer so it also works for a
-- member who can edit contracts but not employees.
create or replace function sync_employee_has_contract()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update employees set has_contract = true where id = coalesce(new.employee_id, old.employee_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists contracts_sync_employee on contracts;
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
  line_items jsonb not null default '[]'::jsonb, -- [{description, quantity, unit_price, total}]
  vat_rate numeric(5,2) not null default 19,
  net_amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status angebot_status not null default 'draft',
  file_path text,
  created_by uuid references app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table angebots add column if not exists issue_date date not null default current_date;
alter table angebots add column if not exists valid_until date;
alter table angebots add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table angebots add column if not exists vat_rate numeric(5,2) not null default 19;
alter table angebots add column if not exists net_amount numeric(12,2) not null default 0;
alter table angebots add column if not exists vat_amount numeric(12,2) not null default 0;
alter table angebots add column if not exists total_amount numeric(12,2) not null default 0;
alter table angebots add column if not exists status angebot_status not null default 'draft';
alter table angebots add column if not exists file_path text;
alter table angebots add column if not exists created_by uuid references app_users (id) on delete set null;
alter table angebots add column if not exists created_at timestamptz not null default now();
alter table angebots add column if not exists updated_at timestamptz not null default now();

drop trigger if exists angebots_set_updated_at on angebots;
create trigger angebots_set_updated_at
  before update on angebots
  for each row execute function set_updated_at();

-- Accepting an offer promotes the firm to 'client'. Security definer so it works for a
-- member who can edit offers but not firms.
create or replace function angebot_signed_promotes_firm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and (old.status is distinct from new.status) then
    update firms set status = 'client' where id = new.firm_id and status <> 'client';
  end if;
  return new;
end;
$$;

drop trigger if exists angebots_promote_firm on angebots;
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
  created_by uuid references app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table invoices add column if not exists angebot_id uuid references angebots (id);
alter table invoices add column if not exists issue_date date not null default current_date;
alter table invoices add column if not exists due_date date;
alter table invoices add column if not exists service_period_start date;
alter table invoices add column if not exists service_period_end date;
alter table invoices add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table invoices add column if not exists vat_rate numeric(5,2) not null default 19;
alter table invoices add column if not exists net_amount numeric(12,2) not null default 0;
alter table invoices add column if not exists vat_amount numeric(12,2) not null default 0;
alter table invoices add column if not exists total_amount numeric(12,2) not null default 0;
alter table invoices add column if not exists status invoice_status not null default 'draft';
alter table invoices add column if not exists file_path text;
alter table invoices add column if not exists created_by uuid references app_users (id) on delete set null;
alter table invoices add column if not exists created_at timestamptz not null default now();
alter table invoices add column if not exists updated_at timestamptz not null default now();

drop trigger if exists invoices_set_updated_at on invoices;
create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- Deleting a member keeps the records they created — only the attribution is dropped.
-- (Re-applies the rule to tables created before it existed.)
do $$
declare
  fk record;
begin
  for fk in
    select * from (values
      ('firms', 'created_by', 'firms_created_by_fkey'),
      ('angebots', 'created_by', 'angebots_created_by_fkey'),
      ('invoices', 'created_by', 'invoices_created_by_fkey')
    ) as v (tbl, col, conname)
  loop
    if exists (
      select 1 from pg_constraint
      where conname = fk.conname and conrelid = fk.tbl::regclass and confdeltype <> 'n'
    ) then
      execute format('alter table %I drop constraint %I', fk.tbl, fk.conname);
      execute format('alter table %I add constraint %I foreign key (%I) references app_users (id) on delete set null', fk.tbl, fk.conname, fk.col);
    end if;
  end loop;
end $$;

-- ============================================================================
-- FIRM STATUS HISTORY (audit trail: who changed a firm's status, and when)
-- ============================================================================

create table if not exists firm_status_history (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  old_status firm_status,
  new_status firm_status not null,
  changed_by uuid references app_users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists firm_status_history_firm_idx on firm_status_history (firm_id);
create index if not exists firm_status_history_changed_at_idx on firm_status_history (changed_at desc);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'firm_status_history_changed_by_fkey' and conrelid = 'firm_status_history'::regclass and confdeltype <> 'n'
  ) then
    alter table firm_status_history drop constraint firm_status_history_changed_by_fkey;
    alter table firm_status_history add constraint firm_status_history_changed_by_fkey
      foreign key (changed_by) references app_users (id) on delete set null;
  end if;
end $$;

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

drop trigger if exists firms_log_status_change on firms;
create trigger firms_log_status_change
  after insert or update on firms
  for each row execute function log_firm_status_change();

-- Feed for the dashboard's "Recent Activity": joins in the firm and the operator's name.
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
-- DASHBOARD DAILY SNAPSHOT (for the "vs last month" trends on the stat cards)
-- ============================================================================

create table if not exists dashboard_daily_snapshot (
  snapshot_date date primary key,
  total_firms int not null,
  sent_count int not null,
  responded_count int not null,
  negotiation_count int not null,
  client_count int not null,
  in_progress_count int not null default 0,
  cities_completed int not null,
  cities_total int not null,
  created_at timestamptz not null default now()
);

do $$
begin
  -- 'interested' was renamed to 'negotiation'.
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dashboard_daily_snapshot' and column_name = 'interested_count')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dashboard_daily_snapshot' and column_name = 'negotiation_count') then
    alter table dashboard_daily_snapshot rename column interested_count to negotiation_count;
  end if;
end $$;

alter table dashboard_daily_snapshot add column if not exists in_progress_count int not null default 0;

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

-- Nightly snapshot at 00:05 UTC via pg_cron. If pg_cron isn't enabled on your project
-- (Database -> Extensions), this is skipped with a notice — enable it and re-run.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
  begin
    perform cron.unschedule('dashboard-daily-snapshot');
  exception when others then
    null; -- job didn't exist yet
  end;
  perform cron.schedule('dashboard-daily-snapshot', '5 0 * * *', 'select record_dashboard_snapshot();');
exception when others then
  raise notice 'pg_cron is not available (%), the nightly dashboard snapshot was not scheduled.', sqlerrm;
end $$;

-- One snapshot now, so today has a baseline row immediately.
select record_dashboard_snapshot();

-- ============================================================================
-- ROW LEVEL SECURITY
--   * Nothing is public: every table needs a signed-in, active app user.
--   * Each data table is gated by the PAGE it belongs to (read to see, write to change).
--   * Members can't change their own role, status or permissions — only the admin
--     (through the server, with the service key) can.
-- ============================================================================

alter table workspaces enable row level security;
alter table app_users enable row level security;
alter table user_permissions enable row level security;
alter table firms enable row level security;
alter table city_completion enable row level security;
alter table employees enable row level security;
alter table contracts enable row level security;
alter table counters enable row level security;
alter table angebots enable row level security;
alter table invoices enable row level security;
alter table firm_status_history enable row level security;
alter table dashboard_daily_snapshot enable row level security;

-- Policies are dropped and recreated so re-running always leaves the current rules
-- (including removing the older, broader "any app user" ones).
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('workspaces', 'app_users', 'user_permissions', 'firms', 'city_completion', 'employees',
                        'contracts', 'counters', 'angebots', 'invoices', 'firm_status_history', 'dashboard_daily_snapshot')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "members read own workspace" on workspaces
  for select using (id = (select workspace_id from app_users where id = auth.uid()) and is_app_user());

-- App users: everyone reads their own row; every active user can read the (small) list so the
-- activity feed can show operators' names. Changes only via the admin server actions.
create policy "app_users read self" on app_users for select using (id = auth.uid());
create policy "app_users can read all app_users" on app_users for select using (is_app_user());
create policy "app_users update own theme" on app_users
  for update using (id = auth.uid() and is_app_user()) with check (id = auth.uid());

create policy "read own permissions" on user_permissions
  for select using (user_id = auth.uid() or is_admin());

create policy "app_users can read firm_status_history" on firm_status_history for select using (is_app_user());
-- No insert/update/delete policy: rows are only written by the security-definer trigger above.
create policy "app_users can read dashboard_daily_snapshot" on dashboard_daily_snapshot for select using (is_app_user());

create policy "page access read firms" on firms
  for select using (has_any_page_access(array['firms', 'dashboard', 'cities', 'offers', 'invoices']));
create policy "page access insert firms" on firms for insert with check (has_page_access('firms', 'write'));
create policy "page access update firms" on firms for update using (has_page_access('firms', 'write'));
create policy "page access delete firms" on firms for delete using (has_page_access('firms', 'write'));

create policy "page access read city_completion" on city_completion
  for select using (has_any_page_access(array['cities', 'dashboard']));
create policy "page access insert city_completion" on city_completion for insert with check (has_page_access('cities', 'write'));
create policy "page access update city_completion" on city_completion for update using (has_page_access('cities', 'write'));
create policy "page access delete city_completion" on city_completion for delete using (has_page_access('cities', 'write'));

create policy "page access read employees" on employees
  for select using (has_any_page_access(array['employees', 'contracts', 'dashboard']));
create policy "page access insert employees" on employees for insert with check (has_page_access('employees', 'write'));
create policy "page access update employees" on employees for update using (has_page_access('employees', 'write'));
create policy "page access delete employees" on employees for delete using (has_page_access('employees', 'write'));

create policy "page access read contracts" on contracts
  for select using (has_any_page_access(array['contracts', 'employees']));
create policy "page access insert contracts" on contracts for insert with check (has_page_access('contracts', 'write'));
create policy "page access update contracts" on contracts for update using (has_page_access('contracts', 'write'));
create policy "page access delete contracts" on contracts for delete using (has_page_access('contracts', 'write'));

create policy "page access read angebots" on angebots
  for select using (has_any_page_access(array['offers', 'invoices', 'dashboard']));
create policy "page access insert angebots" on angebots for insert with check (has_page_access('offers', 'write'));
create policy "page access update angebots" on angebots for update using (has_page_access('offers', 'write'));
create policy "page access delete angebots" on angebots for delete using (has_page_access('offers', 'write'));

create policy "page access read invoices" on invoices
  for select using (has_any_page_access(array['invoices', 'dashboard']));
create policy "page access insert invoices" on invoices for insert with check (has_page_access('invoices', 'write'));
create policy "page access update invoices" on invoices for update using (has_page_access('invoices', 'write'));
create policy "page access delete invoices" on invoices for delete using (has_page_access('invoices', 'write'));

create policy "page access read counters" on counters
  for select using (has_any_page_access(array['offers', 'invoices']));

-- Column-level lock: a signed-in user may change ONLY their own theme on app_users.
revoke insert, update, delete on app_users from anon, authenticated;
grant update (theme_preference, assistant_placement) on app_users to authenticated;
revoke insert, update, delete on user_permissions from anon, authenticated;
revoke insert, update, delete on workspaces from anon, authenticated;

-- ============================================================================
-- STORAGE (generated documents: offers, invoices, contracts) — private bucket
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "app_users can read documents" on storage.objects;
create policy "app_users can read documents"
  on storage.objects for select
  using (bucket_id = 'documents' and is_app_user());

drop policy if exists "app_users can upload documents" on storage.objects;
create policy "app_users can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and is_app_user());

drop policy if exists "app_users can update documents" on storage.objects;
create policy "app_users can update documents"
  on storage.objects for update
  using (bucket_id = 'documents' and is_app_user());

drop policy if exists "app_users can delete documents" on storage.objects;
create policy "app_users can delete documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and is_app_user());

-- ============================================================================
-- LIVE UPDATES — publish the data tables to Supabase Realtime, so the app refreshes stats
-- the moment something changes. Realtime still only delivers rows the user may read (RLS).
-- ============================================================================

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
