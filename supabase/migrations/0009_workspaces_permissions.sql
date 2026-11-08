-- Workspaces + per-page permissions.
--
-- Adds:
--   * workspaces               — the default "Dua Dev" workspace (one for now)
--   * app_users.workspace_id / account_role ('admin' | 'user') / is_active
--   * app_users.role           — now the free-text COMPANY position (CTO, Designer, ...)
--   * user_permissions         — per-user, per-page 'read' | 'write' (no row = no access)
--   * has_page_access()        — used by RLS so the database enforces the same rules as the UI
--
-- Members are created by the admin through the app (Supabase Admin API, service
-- key on the server) — nothing here lets a signed-in user change roles or
-- permissions, including their own.
-- Run after 0008_theme_preference.sql, then run scripts/create_admin_saramalik.sql.

-- ============================================================================
-- WORKSPACES
-- ============================================================================

create table workspaces (
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

comment on column app_users.role is 'Company position, free text (e.g. CTO). Not an access role — see account_role.';
comment on column app_users.account_role is 'Access role: admin (manages the workspace, full access) or user (page permissions apply).';

update app_users set workspace_id = '00000000-0000-0000-0000-00000000d0a0' where workspace_id is null;
alter table app_users alter column workspace_id set not null;
-- Single default workspace for now: inserts that don't name one (seed.sql, older scripts) land in it.
alter table app_users alter column workspace_id set default '00000000-0000-0000-0000-00000000d0a0';

-- One admin per workspace is enough for now; the app never creates a second one.
create unique index app_users_one_admin_per_workspace on app_users (workspace_id) where account_role = 'admin';

-- ============================================================================
-- PAGE PERMISSIONS
-- ============================================================================

create table user_permissions (
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

-- True when the caller can read at least one of the pages — for tables that
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
-- status changes they made) — keep the records, drop the attribution.
-- ============================================================================

alter table firms drop constraint if exists firms_created_by_fkey;
alter table firms add constraint firms_created_by_fkey foreign key (created_by) references app_users (id) on delete set null;

alter table angebots drop constraint if exists angebots_created_by_fkey;
alter table angebots add constraint angebots_created_by_fkey foreign key (created_by) references app_users (id) on delete set null;

alter table invoices drop constraint if exists invoices_created_by_fkey;
alter table invoices add constraint invoices_created_by_fkey foreign key (created_by) references app_users (id) on delete set null;

alter table firm_status_history drop constraint if exists firm_status_history_changed_by_fkey;
alter table firm_status_history add constraint firm_status_history_changed_by_fkey foreign key (changed_by) references app_users (id) on delete set null;
