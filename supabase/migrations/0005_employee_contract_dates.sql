-- Contract duration for contract-based employees.
-- Run after 0004_employee_employment_type.sql.

alter table employees
  add column contract_start_date date,
  add column contract_end_date date;

-- Only contract-based staff carry a duration, and it must run forwards.
alter table employees
  add constraint employees_contract_dates_valid
  check (
    contract_end_date is null
    or contract_start_date is null
    or contract_end_date >= contract_start_date
  );
