-- One-off: reset the password for saramalik@dua-dev.com.
-- Run in Supabase Dashboard -> SQL Editor. DELETE THIS FILE afterwards (it contains a password).
-- Change the password after signing in (Profile -> Change password).

do $$
declare
  target_email text := 'saramalik@dua-dev.com';
  new_password text := 'KbxaBdaAS3t2vU9eAa7!';
  target_id uuid;
begin
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
