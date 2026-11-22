-- Creates the ApexCRM Website Showcase sample logins in Supabase Auth + app_users:
--   1. Admin Demo:  demo@apexcrm.io  /  ApexDemo2026!   (Alex Vance · VP of Operations · admin)
--   2. Team Demo:   team@apexcrm.io  /  ApexTeam2026!   (Maya Lin · Operations Manager · user with full module access)
--
-- Safe to run multiple times (idempotent).

do $$
declare
  workspace_uuid uuid := '00000000-0000-0000-0000-00000000d0a0';
  admin_uid      uuid;
  team_uid       uuid;
  emp_uid        uuid;
begin
  -- Ensure default workspace exists
  insert into workspaces (id, name)
  values (workspace_uuid, 'ApexCRM Enterprise')
  on conflict (id) do update set name = excluded.name;

  -- ==========================================================================
  -- 1. SAMPLE ADMIN LOGIN: demo@apexcrm.io / ApexDemo2026!
  -- ==========================================================================
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
  else
    update auth.users
    set encrypted_password = extensions.crypt('ApexDemo2026!', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = admin_uid;
  end if;

  -- Demote any existing admin in the sample workspace so the unique index on (workspace_id) where account_role = 'admin' is respected
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

  -- ==========================================================================
  -- 2. SAMPLE TEAM LOGIN: team@apexcrm.io / ApexTeam2026!
  -- ==========================================================================
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
  else
    update auth.users
    set encrypted_password = extensions.crypt('ApexTeam2026!', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = team_uid;
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
      ('dashboard'),
      ('firms'),
      ('cities'),
      ('employees'),
      ('contracts'),
      ('offers'),
      ('invoices'),
      ('hiring'),
      ('projects'),
      ('time_leave'),
      ('expenses')
  ) as p (page)
  on conflict (user_id, page) do update set access = 'write';

  -- ==========================================================================
  -- 3. SAMPLE EMPLOYEE SELF-SERVICE LOGIN: employee@apexcrm.io / ApexStaff2026!
  -- ==========================================================================
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
  else
    update auth.users
    set encrypted_password = extensions.crypt('ApexStaff2026!', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = emp_uid;
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

  raise notice 'Sample logins ready: demo@apexcrm.io, team@apexcrm.io, employee@apexcrm.io';
end $$;
