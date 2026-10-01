-- Independent check of three figures shown for SOL-ALU-FRAME (data up to 2025-12-08).
-- 1) Monthly quantity-weighted purchase price, last 3 months, and the standard cost in force.
WITH monthly AS (
  SELECT date_trunc('month', purchase_date)::date AS month,
         SUM(quantity * unit_price) / SUM(quantity) AS weighted_price
  FROM purchase_records
  WHERE material_id = 'SOL-ALU-FRAME' AND currency = 'USD' AND purchase_date <= DATE '2025-12-08'
  GROUP BY 1
)
SELECT m.month, ROUND(m.weighted_price::numeric, 4) AS actual_price,
       c.standard_cost,
       ROUND(((m.weighted_price / c.standard_cost - 1) * 100)::numeric, 1) AS pct_above_standard
FROM monthly m
JOIN material_costs c
  ON c.material_id = 'SOL-ALU-FRAME'
 AND c.effective_from <= (date_trunc('month', m.month) + interval '1 month - 1 day')::date
 AND (c.effective_to IS NULL OR c.effective_to >= (date_trunc('month', m.month) + interval '1 month - 1 day')::date)
ORDER BY m.month DESC LIMIT 3;

-- 2) Share of the last 365 days' spend by supplier.
SELECT supplier_id, ROUND(SUM(quantity * unit_price)::numeric, 2) AS spend,
       ROUND((100 * SUM(quantity * unit_price) / SUM(SUM(quantity * unit_price)) OVER ())::numeric, 1) AS share_pct
FROM purchase_records
WHERE material_id = 'SOL-ALU-FRAME' AND purchase_date > DATE '2025-12-08' - 365 AND purchase_date <= DATE '2025-12-08'
GROUP BY supplier_id ORDER BY spend DESC;

-- 3) Lead time: average of readings in the last 90 days vs the 90 days before (supplier SUP-006).
SELECT CASE WHEN metric_date > DATE '2025-12-08' - 90 THEN 'last 90 days' ELSE 'previous 90 days' END AS period,
       ROUND(AVG(lead_time_days)::numeric, 1) AS avg_lead_days, ROUND(AVG(on_time_delivery_rate)::numeric, 3) AS avg_on_time
FROM supplier_operations_metrics
WHERE supplier_id = 'SUP-006' AND metric_date <= DATE '2025-12-08' AND metric_date > DATE '2025-12-08' - 180
GROUP BY 1 ORDER BY 1 DESC;
