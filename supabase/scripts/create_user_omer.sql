-- Creates the login for Omer Farooq — company role CEO, account role USER (not admin) — in the same
-- workspace as the admin, with read & write access to every page (User Management is never included:
-- only the workspace admin can open it).
--
--   Email:    info@dua-dev.com
--   Password: !Duresameen8989
--
-- Run in Supabase Dashboard -> SQL Editor, AFTER migrations/0009 (or supabase/schema.sql) and after
-- scripts/create_admin_saramalik.sql. Safe to run more than once:
--   * if the login already exists it is kept as it is (password untouched) and only its profile and
--     page permissions are (re)set;
--   * otherwise it is created with the password above.
--
-- DELETE THIS FILE (or blank the password) once he has signed in — it contains a password. Ask him to change
-- it from Profile -> Change password.

do $$
declare
  user_email    text := 'info@dua-dev.com';
  user_name     text := 'Omer Farooq';
  company_role  text := 'CEO';
  user_password text := '!Duresameen8989';
  workspace     uuid;
  uid           uuid;
begin
  -- Same workspace as the admin (falls back to the default workspace).
  select workspace_id into workspace from app_users where account_role = 'admin' and is_active order by created_at limit 1;
  workspace := coalesce(workspace, '00000000-0000-0000-0000-00000000d0a0');

  select id into uid from auth.users where lower(email) = lower(user_email);

  if uid is null then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(user_email), extensions.crypt(user_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', user_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', lower(user_email), 'email_verified', true),
      now(), now(), now()
    );

    raise notice 'Created login % (id %)', user_email, uid;
  else
    raise notice 'Login % already exists (id %) — password left unchanged', user_email, uid;
  end if;

  -- A regular user, never an admin.
  insert into app_users (id, full_name, role, workspace_id, account_role, is_active)
  values (uid, user_name, company_role, workspace, 'user', true)
  on conflict (id) do update
    set full_name    = excluded.full_name,
        role         = excluded.role,
        workspace_id = excluded.workspace_id,
        account_role = 'user',
        is_active    = true;

  -- Read & write on every page (dashboard/overview, firms, cities, employees, contracts, offers, invoices).
  delete from user_permissions where user_id = uid;
  insert into user_permissions (user_id, page, access)
  select uid, p.page, 'write'
  from (values ('dashboard'), ('firms'), ('cities'), ('employees'), ('contracts'), ('offers'), ('invoices')) as p (page);

  raise notice '% is now a USER (company role: %) with read & write on all 7 pages', user_name, company_role;
end
$$;

-- Check:
select u.email, a.full_name, a.role as company_role, a.account_role, a.is_active, w.name as workspace,
       (select count(*) from user_permissions p where p.user_id = a.id and p.access = 'write') as pages_with_write_access
from app_users a
join auth.users u on u.id = a.id
join workspaces w on w.id = a.workspace_id
where lower(u.email) = 'info@dua-dev.com';
