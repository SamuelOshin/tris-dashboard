# TRIS v2.0 — Material Risk Score Method

How **Manufacturing → Material Cost Intelligence** turns a material's recent data into a 0–100 risk score with a
reason for every point. Method version **1.0**, default weights **version 1**.

Code: `backend/app/api/modules/v1/manufacturing/service/` — `risk_types.py` (factor catalogue and default weights),
`risk_factors.py` (measures the nine factors), `risk_scoring_engine.py` (the score; pure functions),
`risk_scoring_service.py` (the `MaterialRiskScoringService`: loads data, stores scores and weight sets).
Tables: `material_risk_weight_sets`, `material_risk_scores`. Endpoints: `/api/v1/manufacturing/risk-scoring/…`.
Tests: `test_material_risk_scoring.py`.

## The score

```
sub_score(f) = clamp( (value_f - low_f) / (high_f - low_f), 0, 1 )        0 at "low", 1 at "high"
score        = 100 × Σ ( weight_f × sub_score_f ) / Σ weight_f             over factors that could be measured
```

- Each factor's **value** is measured from the data (table below). Its **scale** (`low`, `high`) turns the value into a
  sub-score between 0 and 1; values beyond the scale are held at 0 or 1. For factors where *less* is riskier
  (inventory coverage) `low` is larger than `high`.
- The **weight** says how much a factor counts. Weights add up to 100.
- A factor that **cannot be measured** (no data) is **left out and the remaining weights are rescaled**, so a missing
  input never silently lowers or raises the score. The share of the weighting that had data is stored as *data
  coverage*. If coverage is below `min_evaluable_weight` (default 50%), **no score is produced** — never a default.
- The result is on a **0–100** scale, stored rounded to 4 decimals, and mapped to a level by the bands **from that stored value**, so a stored score and its level can never disagree.

| Level | Score |
|:---|:---|
| Low | below 25 |
| Moderate | 25 to below 50 |
| High | 50 to below 75 |
| Critical | 75 and above |

Bands, weights, scales and the minimum coverage are all part of the versioned weight set.

## Factors, default weights (version 1) and scales

| Factor | Weight | Value measured | Scores 0 at | Scores 1 at |
|:---|---:|:---|---:|---:|
| Price change | 15 | % change of the latest monthly price vs about 3 months earlier | 0% | +15% |
| Price volatility | 10 | spread (standard deviation) of month-to-month % price changes between **consecutive calendar months**, latest 12 such changes; needs 6 | 1% | 8% |
| Predicted increase | 15 | the stored forecast (longest horizon available for the date) vs the latest price, % | 0% | +10% |
| Product cost exposure | 10 | the material's largest share of the material cost of any product that uses it, % | 5% | 40% |
| Demand trend | 5 | purchased quantity over the latest 3 **calendar months** vs the 3 before, % (a month with no purchases counts as zero; the history must reach back 6 months from the latest purchase month) | 0% | +30% |
| Supplier concentration | 15 | the main supplier's share of the last 12 months' spend, % | 50% | 100% |
| Inventory coverage | 10 | days of usage the current stock covers | 60 days | 15 days |
| Supplier lead time | 10 | the main supplier's latest lead time, days | 14 days | 90 days |
| Standard cost deviation | 10 | latest price above the standard cost in force, % | 0% | +15% |
| **Total** | **100** | | | |

Values come from the same as-of-limited data and metrics as Material Cost Intelligence (Ticket 6) and from stored
forecasts (Ticket 7); nothing dated after the as-of date is used. The product cost exposure compares
`BOM quantity × latest price` across the product's components and skips a product whose components are priced in
different currencies or lack a price.

### Worked example (from the automated tests)

A material bought every month at a flat price from two suppliers (60% / 40%), with a stored 30-day forecast 10% above
the latest price. Measured: price change 0%, volatility 0%, predicted increase 10%, demand 0%, supplier concentration
60%; the other four factors have no data (coverage 60%).

| Factor | Weight | Sub-score | Points |
|:---|---:|---:|---:|
| Price change | 15 | 0.00 | 0.0 |
| Price volatility | 10 | 0.00 | 0.0 |
| Predicted increase | 15 | 1.00 | 25.0 |
| Demand trend | 5 | 0.00 | 0.0 |
| Supplier concentration | 15 | 0.20 | 5.0 |

`score = 100 × (15×0 + 10×0 + 15×1 + 5×0 + 15×0.2) / 60 = 30` → **Moderate**. "Points" are each factor's part of the
final score (`100 × weight × sub-score ÷ evaluable weight`), so the points always add up to the score.

## Explainability

Every stored score keeps, for each factor: the measured value, its scale, weight, sub-score, points, and a
plain-language reason, for example *"The latest monthly price is 8.4% above the price three months ago. On this
factor's scale (0% scores 0, 15% scores 1) that is 0.56, which adds 8.4 points to the score."* A factor that could not be
measured says why (*"Not used: No supplier lead time is on record."*). A one-line summary names the main drivers. The
Material Risk Detail panel shows these factor by factor.

## Versioned weights and stored scores

- **Weight sets are versions.** The newest version is active. Changing weights (`POST /risk-scoring/weights`, admin only)
  **adds a new version**; earlier versions are never edited or deleted. A new version needs: weights for exactly the nine
  factors adding up to 100, two different scale values per factor, increasing bands (`0 < moderate < high < critical ≤ 100`),
  and a note saying why. Invalid sets are refused (booleans, NaN and infinity are not valid settings). Creation is serialised, so simultaneous changes get distinct, consecutive version numbers. Version 1 holds the documented defaults and is created on first use.
- **Every run is a stored row** in `material_risk_scores`: score, level, coverage, every factor, a copy of the exact weights
  and scales used, the weight version, the stored forecast it used, a fingerprint of the measured inputs, who ran it and
  when. A re-run adds a new row. Rows cannot be updated or deleted (a database trigger refuses both), so any historical
  score is retained exactly as it was and can be recomputed from its own record (tested).
- Running scoring needs an admin or reviewer; viewing scores is open to roles that can see Manufacturing.

## Independence from the R-001…R-007 rule engine (decision D4)

The scoring service is a separate service with its own tables and its own versioning. It shares **no state or code**
with the rule engine, and this is checked by tests:

1. The scoring code imports nothing from the rules, remediation or reconstruction packages and never names
   `RuleConfig`; the rule-engine packages import nothing from the scoring code.
2. The scoring tables have no foreign key to or from `rule_configs`.
3. Running scoring and creating new weight versions leaves every `rule_configs` row byte-identical.
4. Changing `rule_configs` (weights, thresholds, version, active flag) leaves a material's score, level and input
   fingerprint unchanged.
5. The existing acceptance suite (`tests/test_acceptance_t01_t10.py`) passes unchanged.

## Limitations

- **Not a prediction.** The score ranks how exposed a material looks today given the data; it is not a forecast of loss.
- **Weights and scales are judgement, not fitted.** The defaults are a documented starting point. Whether they rank
  materials usefully is tested by the validation work (Ticket 11), not assumed here.
- **Linear scales and a weighted sum** are easy to explain but cannot express interactions (for example low stock
  *and* a long lead time being worse than the sum of both).
- **Data-dependent.** Without a stored forecast, stock levels, lead times or standard costs, those factors are left out
  and the score rests on the rest; the data coverage figure says how much.
- **Latest month included.** The price factors use the monthly series as Material Cost Intelligence shows it, including
  a month that is still incomplete at the as-of date.
- **A material that cannot be scored is not stored**, but it is always reported with the reason: too little data, or no purchases at all.
- **Weights are changed through the API** in this release; there is no editing screen yet.
- **Synthetic data.** Results on the sample dataset demonstrate the method, not real company risk.
