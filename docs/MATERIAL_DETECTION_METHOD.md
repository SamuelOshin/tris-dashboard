# TRIS v2.0 — Material-Cost Detection Method

How the Material Cost Intelligence overview (**Manufacturing → Material Cost Intelligence**) turns stored
purchase, cost, stock and supplier records into signals. This covers *detection* only. Forecast cost,
financial exposure and the risk score are separate, later features; the screen says so and shows none of them.

Code: `backend/app/api/modules/v1/manufacturing/service/` (`detection_engine.py`, `detectors_price.py`,
`detectors_exposure.py`, `price_series.py`, thresholds in `analytics_types.py` → `DetectionConfig`).
Endpoints: `GET /api/v1/manufacturing/analytics/overview` and `/materials/{material_id}`.

## Principles

1. **Computed on request from the database.** No figure is stored or typed in; change the data and the figures change.
2. **As-of date, not the clock.** The analysis describes a date (default: the latest purchase date in the data,
   or the date the user picks). Only records dated on or before it are read (purchase date, snapshot date,
   metric date, period end, cost effective-from). Later records cannot influence an earlier result.
3. **Missing data is never "clear".** A detector that cannot run says *Not enough data* and why. It does not
   report a clean bill of health on missing evidence.
4. **Currencies are never mixed.** A material's analysis uses its most common currency; lines in other currencies
   are left out and the screen says how many. Spend is ranked and shared only among materials in the same currency,
   the summary shows one total only when every material shares a currency (otherwise a per-currency list), and a
   product whose components are priced in different currencies is not assessed for cost escalation.
5. **Every signal explains itself** with the numbers, the limit, and the months or suppliers involved.
6. Thresholds are one reviewable configuration (`DetectionConfig`), shown in the overview response. They are
   starting values for a prototype, not tuned to any real company.

## Building blocks

- **Monthly price** = Σ(quantity × unit price) ÷ Σ(quantity) over the purchase lines of a calendar month.
- **Standard cost in force** on a date = the cost version with the latest *effective-from* that covers the date
  (highest version breaks ties), in the same currency.
- **Change %** = (new ÷ old − 1) × 100.
- **Spend window** = the last 365 days up to the as-of date, price × quantity.

## Signals

| Signal | Triggers when | Default limits | Needs |
|:---|:---|:---|:---|
| Rapid price increase | Latest month's price is up on the previous month with purchases | ≥ 10% | 2 months of purchases |
| Price unusual for this material | Latest month is this many standard deviations above its own recent average | z ≥ 2.0 over up to 12 earlier months | 6 earlier months |
| Paying above standard cost | Actual monthly price is above the standard in force in **every** one of the last 3 months | ≥ 5% each month | A standard cost; 3 months of purchases |
| Purchase price variance worsening | PPV for the last 3 periods is strictly rising and the latest is above zero. Uses reported PPV, else (actual − standard) × quantity per period, else derives it per month from purchases and standard cost | 3 periods | Variance records or purchases + standard |
| Unusual purchase lines | A purchase line in the last 90 days has a unit price or quantity ≥ 3 standard deviations from the earlier lines | z ≥ 3.0 | 8 earlier lines |
| Product material cost rising | A product that uses the material saw its material cost (Σ BOM quantity × component price) rise over 90 days **and** this material accounts for enough of the rise | rise ≥ 5%, share ≥ 25% | BOM line; prices for every component at both dates |
| Dependence on one supplier | One supplier's share of the last year's spend | ≥ 70% | Purchases with a supplier |
| Low stock while prices rise | Stock cover is below the limit **and** the price is up over about 90 days | cover < 30 days, price ≥ +5% | A stock snapshot; prices 90 days apart |
| Among the highest-spend materials | Material is in the top fifth of materials by last-year spend | top 20%, at least 5 materials | Purchases |
| Supplier lead time or delivery getting worse | For any single supplier: average lead time over the last 90 days vs the 90 days before is up, or average on-time rate has fallen | lead time ≥ +20%, on-time −0.10 | 2 readings in each period |

Notes:
- **Stock cover** = quantity on hand ÷ average daily purchase quantity over the last 90 days (a usage proxy
  unless the source reports days of supply, which is then used and labelled).
- **Lead time is judged per supplier** so a stable supplier cannot hide a deteriorating one.
- **BOM unit of measure** is assumed to match the material's; no unit conversion is done.
- Supplier operations rows apply to a material directly, or through suppliers it has actually bought from by the
  as-of date. The material–supplier link table is not used for this because it carries no business date and a later
  link could otherwise influence an earlier analysis.
- Prices use calendar-month averages, so a "90 days ago" price is the month containing that date (never later than
  the as-of date).

## What the overview shows per material

Current unit cost (and month), change over the last month and 3 months, difference to standard cost, 12-month
spend and share of total, main supplier and its share, stock cover, and the signals that fired. Hovering a chip
shows the explanation; the detail panel shows all ten checks (signal / clear / not enough data), the monthly price
against standard cost, supplier spend split, products using the material, and data notes.

## Verified example (synthetic data, aluminium frame profile, data up to 8 Dec 2025)

`docs/evidence/ticket-6/independent_sql_check.sql` recomputes the screen's figures in plain SQL:
Oct/Nov/Dec 2025 actual price 4.4215 / 4.2354 / 4.2113 against standard 3.5609 = +24.2% / +18.9% / +18.3%;
SUP-006 supplies 83.2% of the last year's spend; SUP-006 lead time 18.4 → 33.9 days.

## Not in scope here

Forecast cost, estimated financial exposure, risk score and High/Medium/Low level (Tickets 7–9), creating or linking
a case (Ticket 10), and exporting the table. The overview has no risk-level filter for that reason.
Choosing a date earlier than the first purchase shows a notice with the earliest purchase date (data exists, just not
by then), not the empty state; an unknown signal filter is rejected.
