-- Offers statuses, employee salary, and manual-only city status.
-- Run after 0005_employee_contract_dates.sql.

-- ---------------------------------------------------------------------------
-- 1. Offer (Angebot) statuses: draft / sent / accepted / rejected
--    Existing 'signed' offers become 'accepted'; 'expired' ones 'rejected'.
-- ---------------------------------------------------------------------------

alter type angebot_status rename to angebot_status_old;
create type angebot_status as enum ('draft', 'sent', 'accepted', 'rejected');

alter table angebots alter column status drop default;
alter table angebots
  alter column status type angebot_status
  using (
    case status::text
      when 'signed' then 'accepted'
      when 'expired' then 'rejected'
      else status::text
    end
  )::angebot_status;
alter table angebots alter column status set default 'draft';

drop type angebot_status_old;

-- Accepting an offer promotes the firm to 'client' (was: signing).
create or replace function angebot_signed_promotes_firm()
returns trigger language plpgsql as $$
begin
  if new.status = 'accepted' and (old.status is distinct from new.status) then
    update firms set status = 'client' where id = new.firm_id and status <> 'client';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Employee salary, entered per month or per year
-- ---------------------------------------------------------------------------

alter table employees
  add column salary_amount numeric(12, 2),
  add column salary_period text;

alter table employees
  add constraint employees_salary_valid
  check (
    (salary_amount is null and salary_period is null)
    or (salary_amount > 0 and salary_period in ('month', 'year'))
  );

-- ---------------------------------------------------------------------------
-- 3. City status is set by hand only. The firms table can't tell how many
--    firms exist in an area, so "completed" can't be derived from it.
--    Cities without a manual status are 'not_started'.
-- ---------------------------------------------------------------------------

create or replace view city_status as
select
  coalesce(cc.country, s.country) as country,
  coalesce(cc.state, s.state) as state,
  coalesce(cc.city, s.city) as city,
  coalesce(s.firm_count, 0) as firm_count,
  coalesce(cc.manual_status, 'not_started') as status,
  (cc.manual_status is not null) as is_manual_override,
  cc.note
from city_completion cc
full outer join city_status_computed s
  on s.country = cc.country and s.state = cc.state and s.city = cc.city;
