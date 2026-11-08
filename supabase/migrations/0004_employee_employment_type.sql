-- Employment type on the employee roster (full time / part time / contract).
-- Run after 0003_rename_interested_to_negotiation.sql.

create type employment_type as enum ('full_time', 'part_time', 'contract');

alter table employees
  add column employment_type employment_type not null default 'full_time';
