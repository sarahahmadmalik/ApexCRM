-- Firm website.
--
-- The Firms form, the CSV import and the company look-up all read/write
-- `firms.website`, but no earlier migration ever created the column — so saving
-- a firm failed on a database built from the migrations ("column website does
-- not exist"). Optional free text, like the other contact fields.
-- Run after 0009_workspaces_permissions.sql.

alter table firms add column if not exists website text;
