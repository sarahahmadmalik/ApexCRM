-- Replace 'interested' with 'negotiation' in the firm_status enum
-- PostgreSQL doesn't allow renaming enum values directly before PG 10.
-- In Supabase (PG 15+), we can use ALTER TYPE ... RENAME VALUE
ALTER TYPE firm_status RENAME VALUE 'interested' TO 'negotiation';

-- Rename the column in the daily snapshot table
ALTER TABLE dashboard_daily_snapshot RENAME COLUMN interested_count TO negotiation_count;

-- Update the recording function to query 'negotiation' instead of 'interested'
CREATE OR REPLACE FUNCTION record_dashboard_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO dashboard_daily_snapshot (
    snapshot_date, total_firms, sent_count, responded_count, negotiation_count,
    client_count, cities_completed, cities_total
  )
  SELECT
    current_date,
    (SELECT count(*) FROM firms),
    (SELECT count(*) FROM firms WHERE status = 'sent'),
    (SELECT count(*) FROM firms WHERE status = 'responded'),
    (SELECT count(*) FROM firms WHERE status = 'negotiation'),
    (SELECT count(*) FROM firms WHERE status = 'client'),
    (SELECT count(*) FROM city_status WHERE status = 'completed'),
    (SELECT count(*) FROM city_status)
  ON CONFLICT (snapshot_date) DO UPDATE SET
    total_firms = EXCLUDED.total_firms,
    sent_count = EXCLUDED.sent_count,
    responded_count = EXCLUDED.responded_count,
    negotiation_count = EXCLUDED.negotiation_count,
    client_count = EXCLUDED.client_count,
    cities_completed = EXCLUDED.cities_completed,
    cities_total = EXCLUDED.cities_total,
    created_at = now();
END;
$$;
