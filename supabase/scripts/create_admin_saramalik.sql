-- Makes saramalik@dua-dev.com the workspace ADMIN with company role "CTO".
--
-- Run in Supabase Dashboard -> SQL Editor, AFTER migrations/0009_workspaces_permissions.sql.
-- Safe to run more than once:
--   * if the login already exists it is kept as it is (password untouched) and only
--     promoted / re-labelled;
--   * if it doesn't exist it is created with `initial_password` below.
--
-- Never commit a real password in this file. Change the password afterwards from Settings -> Change password.

do $$
declare
  admin_email      text := 'saramalik@dua-dev.com';
  admin_name       text := 'Sara Malik';
  company_role     text := 'CTO';
  initial_password text := 'CHANGE_ME_BEFORE_RUNNING';
  workspace        uuid := '00000000-0000-0000-0000-00000000d0a0';  -- the default "Dua Dev" workspace
  uid              uuid;
begin
  if left(initial_password, 9) = 'CHANGE_ME' then raise exception 'Set a strong password in this script before running it (and never commit it).'; end if;
  select id into uid from auth.users where lower(email) = lower(admin_email);

  if uid is null then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(admin_email), extensions.crypt(initial_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', admin_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', lower(admin_email), 'email_verified', true),
      now(), now(), now()
    );

    raise notice 'Created login % (id %)', admin_email, uid;
  else
    raise notice 'Login % already exists (id %) — password left unchanged', admin_email, uid;
  end if;

  -- Only one admin per workspace: if someone else holds it, stop with a clear message.
  if exists (
    select 1 from app_users where workspace_id = workspace and account_role = 'admin' and id <> uid
  ) then
    raise exception 'Another admin already exists in this workspace. Demote them first.';
  end if;

  insert into app_users (id, full_name, role, workspace_id, account_role, is_active)
  values (uid, admin_name, company_role, workspace, 'admin', true)
  on conflict (id) do update
    set full_name    = excluded.full_name,
        role         = excluded.role,
        workspace_id = excluded.workspace_id,
        account_role = 'admin',
        is_active    = true;

  -- Admins get every page implicitly; drop any leftover per-page rows.
  delete from user_permissions where user_id = uid;

  raise notice 'saramalik@dua-dev.com is now ADMIN (company role: %)', company_role;
end
$$;

-- Check:
select u.email, a.full_name, a.role as company_role, a.account_role, a.is_active, w.name as workspace
from app_users a
join auth.users u on u.id = a.id
join workspaces w on w.id = a.workspace_id
where lower(u.email) = 'saramalik@dua-dev.com';
