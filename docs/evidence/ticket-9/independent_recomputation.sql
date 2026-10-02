-- Independent check of the latest stored SOL-BACKSHEET score (no application code).
-- 1) Recompute the score from the stored per-factor weights and sub-scores.
WITH s AS (
  SELECT score_id, score, level, weight_version, factors::jsonb AS f
  FROM material_risk_scores WHERE material_id='SOL-BACKSHEET' ORDER BY created_at DESC LIMIT 1
), x AS (
  SELECT score_id, score, level, weight_version, e->>'code' AS code,
         (e->>'weight')::float AS w, (e->>'sub_score')::float AS sub, e->>'status' AS st
  FROM s, jsonb_array_elements(f) e
)
SELECT score_id, weight_version, level, round(score::numeric,4) AS stored_score,
       round((100*sum(w*sub) FILTER (WHERE st='evaluated') / sum(w) FILTER (WHERE st='evaluated'))::numeric,4) AS recomputed_score,
       sum(w) FILTER (WHERE st='evaluated') AS evaluated_weight
FROM x GROUP BY score_id, weight_version, level, score;
-- 2) Check two factor values straight from the purchase tables (as of 2025-12-12).
SELECT 'price change 3m %' AS factor,
       round(((SELECT sum(quantity*unit_price)/sum(quantity) FROM purchase_records WHERE material_id='SOL-BACKSHEET' AND purchase_date BETWEEN '2025-12-01' AND '2025-12-12')
            / (SELECT sum(quantity*unit_price)/sum(quantity) FROM purchase_records WHERE material_id='SOL-BACKSHEET' AND purchase_date BETWEEN '2025-09-01' AND '2025-09-30') - 1)::numeric*100, 2) AS value
UNION ALL
SELECT 'top supplier share of 12m spend %',
       round((100*max(sp)/sum(sp))::numeric,1)
FROM (SELECT supplier_id, sum(quantity*unit_price) sp FROM purchase_records
      WHERE material_id='SOL-BACKSHEET' AND purchase_date > '2024-12-12' AND purchase_date <= '2025-12-12' GROUP BY supplier_id) q;
