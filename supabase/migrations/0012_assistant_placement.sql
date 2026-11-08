-- Where each user wants the AI assistant button: in the header, as a floating button, or hidden.
-- Stored on the account so the choice follows the user to any device. Null = the default (header).
-- Run after 0011_realtime.sql.

alter table app_users
  add column if not exists assistant_placement text
  check (assistant_placement in ('header', 'floating', 'hidden'));

-- app_users is column-locked: a signed-in user may change only the columns granted here (see 0009).
grant update (assistant_placement) on app_users to authenticated;
