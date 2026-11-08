-- One-off: reset the password for saramalik@dua-dev.com.
-- Run in Supabase Dashboard -> SQL Editor. Set `new_password` first; never commit a real password.
-- Change the password after signing in (Settings -> Change password).

do $$
declare
  target_email text := 'saramalik@dua-dev.com';
  new_password text := 'CHANGE_ME_BEFORE_RUNNING';
  target_id uuid;
begin
  if left(new_password, 9) = 'CHANGE_ME' then raise exception 'Set a strong password in this script before running it (and never commit it).'; end if;
  select id into target_id from auth.users where lower(email) = lower(target_email);
  if target_id is null then
    raise exception 'No auth user found for %', target_email;
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target_id;

  -- Sign the user out everywhere so old sessions can't outlive the reset.
  delete from auth.sessions where user_id = target_id;

  raise notice 'Password reset for % (id %)', target_email, target_id;
end
$$;
