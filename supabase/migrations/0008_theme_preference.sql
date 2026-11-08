-- Stores each leadership user's theme choice on their account, so it follows
-- them to a new browser or device instead of living only in that browser's
-- localStorage. Null means "no preference saved yet" — the app falls back
-- to the browser's own local/system setting.
-- Run after 0007_snapshot_in_progress_and_geo_cities.sql.

alter table app_users
  add column theme_preference text check (theme_preference in ('light', 'dark', 'system'));
