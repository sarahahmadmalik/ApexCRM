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
  ('11111111-1111-4111-8111-111111111101', 'Senior Full-Stack Engineer (Next.js / TypeScript)', 'Engineering', 'Berlin, Germany (Hybrid)', 'full_time', '78.000 € – 92.000 € / year', 'open', 'Lead architecture and delivery of enterprise client portals and CRM integrations.'),
  ('11111111-1111-4111-8111-111111111102', 'Enterprise Account Executive (DACH)', 'Sales & Growth', 'Munich, Germany', 'full_time', '70.000 € – 85.000 € + OTE', 'open', 'Drive outbound expansion across mid-market and enterprise accounts in Germany, Austria, and Switzerland.'),
  ('11111111-1111-4111-8111-111111111103', 'Product Designer (Design Systems)', 'Product & Design', 'Remote (EU)', 'full_time', '64.000 € – 76.000 € / year', 'open', 'Own the ApexCRM component library, dark/light design tokens, and enterprise workflow UX.'),
  ('11111111-1111-4111-8111-111111111104', 'DevOps & Cloud Security Specialist', 'Engineering', 'Frankfurt, Germany', 'contract', '6.800 € / month', 'paused', 'SOC-2 / ISO-27001 automation, Kubernetes cluster hardening, and CI/CD observability.')
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
  ('55555555-5555-4555-8555-555555555502', 'Sofia Lindqvist', 'remote_work', '2026-11-30', '2026-12-04', 5, 'approved', 'Working remotely from Stockholm design studio', 'Approved — overlaps with EU CET core hours'),
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
  ('77777777-7777-4777-8777-777777777702', 'ICE Rail & Hotel — Munich Enterprise Client Summit', 'Omer Farooq', 'travel', 685.50, 'EUR', '2026-11-19', 'approved', 'DB-99412-MUC', 'On-site contract workshop with DACH enterprise prospects.'),
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
end $$;
