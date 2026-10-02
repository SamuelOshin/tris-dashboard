-- Independent recomputation of SOL-AG-PASTE 30-day exposure from raw tables (no application code).
-- as-of 2025-12-12; last complete month = Nov 2025; usage window = Jun..Nov 2025 (6 months).
WITH win AS (
  SELECT sum(quantity)/6.0 AS monthly_usage
  FROM purchase_records
  WHERE material_id='SOL-AG-PASTE' AND currency='USD'
    AND purchase_date >= '2025-06-01' AND purchase_date <= '2025-11-30'
), lastm AS (
  SELECT sum(quantity*unit_price)/sum(quantity) AS baseline_unit
  FROM purchase_records
  WHERE material_id='SOL-AG-PASTE' AND currency='USD'
    AND purchase_date >= '2025-11-01' AND purchase_date <= '2025-11-30'
), run AS (
  SELECT forecast_value, (config->>'last_observed_price')::float AS stored_last, run_id
  FROM forecast_runs
  WHERE material_id='SOL-AG-PASTE' AND horizon_days=30 AND as_of='2025-12-12' AND dataset_id IS NULL
  ORDER BY created_at DESC LIMIT 1
)
SELECT run.run_id,
       round(win.monthly_usage::numeric,4)            AS usage_30d,
       round(lastm.baseline_unit::numeric,4)          AS baseline_from_purchases,
       round(run.stored_last::numeric,4)              AS baseline_stored_in_run,
       round(run.forecast_value::numeric,4)           AS forecast_unit,
       round((run.stored_last*win.monthly_usage)::numeric,2)       AS baseline_spend,
       round((run.forecast_value*win.monthly_usage)::numeric,2)    AS forecast_spend,
       round(((run.forecast_value-run.stored_last)*win.monthly_usage)::numeric,2) AS projected_exposure
FROM win, lastm, run;
