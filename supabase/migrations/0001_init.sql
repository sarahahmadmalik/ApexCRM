-- Dua Dev internal tool — initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type firm_status as enum (
  'not_started',   -- no outreach yet
  'in_progress',   -- currently sending / working on this firm
  'sent',          -- proposal email sent
  'responded',     -- firm replied
  'interested',    -- firm is close to becoming a client (negotiating)
  'client'         -- firm has become a client
);

create type city_manual_status as enum ('not_started', 'in_progress', 'completed');

create type angebot_status as enum ('draft', 'sent', 'signed', 'rejected', 'expired');

create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');

create type contract_status as enum ('draft', 'final');

-- ============================================================================
-- APP USERS (allowlist — only CEO / CTO get access to this tool)
-- ============================================================================

create table app_users (
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

create table firms (
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

create index firms_country_idx on firms (country);
create index firms_city_idx on firms (city);
create index firms_status_idx on firms (status);
create index firms_name_trgm_idx on firms using gin (to_tsvector('simple', name));

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

create table city_completion (
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

create table employees (
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

create table contracts (
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

create table counters (
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

create table angebots (
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

create table invoices (
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
-- ROW LEVEL SECURITY — every table only readable/writable by allowlisted
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
