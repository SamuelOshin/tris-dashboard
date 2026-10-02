# TRIS v2.0 — Financial Exposure and Scenario Method

How **Manufacturing → Forecasting & Scenarios → Exposure & scenarios** turns a stored price forecast into a cost
exposure, and how what-if scenarios recalculate it. Method version **1.0**.

Code: `backend/app/api/modules/v1/manufacturing/service/` — `exposure_engine.py` (the calculation; pure functions, no
database), `exposure_service.py` (reads stored forecasts and purchase data; never writes), `exposure_types.py`
(settings and containers). Endpoints: `GET /api/v1/manufacturing/exposure`, `POST /api/v1/manufacturing/exposure/scenario`.
Tests: `test_financial_exposure.py`, `test_scenario_does_not_mutate_baseline.py`.

## The formula

Exactly as specified (consolidated instruction, section 5.3):

```
baseline_spend     = baseline_unit_cost * expected_usage
forecast_spend     = forecast_unit_cost * expected_usage
projected_exposure = forecast_spend - baseline_spend
```

It is evaluated per material for a chosen horizon (30 or 90 days), in the material's own currency. A positive exposure
is extra cost expected; a negative one is expected saving. Nothing is rounded before the end.

### The three inputs

| Term | Definition |
|:---|:---|
| `baseline_unit_cost` | The latest complete month's quantity-weighted average purchase price. It is read from the stored forecast run (`last_observed_price`), so the baseline is the very price the forecast was measured from. |
| `forecast_unit_cost` | The **average of the stored forecast path** over the horizon months. For 30 days this is the one forecast month; for 90 days it is the mean of months 1, 2 and 3. Using the average prices each month of usage at its own forecast price; using only the end-of-horizon price would overstate a rising 90-day path. The end-of-horizon value is shown for reference. |
| `expected_usage` | `monthly_usage × horizon_months`. `monthly_usage` is the quantity purchased over the latest **6 complete calendar months** (the same complete months the forecast used) divided by the number of those months. Months with no purchases count as zero (purchasing is lumpy); months before the material's first purchase are not part of the window. Only purchases in the forecast's currency count. |

Usage is a **proxy**: purchased quantity stands in for consumption, because consumption records are not part of the
canonical data. The basis is shown on every row ("from the last 6 months of purchases").

### Where the numbers come from

The forecast values are **never recomputed here**. The newest stored run for the material, horizon, as-of date and
dataset scope is read from `forecast_runs`. If none exists, the material is listed as *not available* with the
reason (no run stored, or too little history for that horizon) and no exposure is shown. This endpoint cannot run
or store a forecast.

Data is limited to business dates on or before the as-of date, as everywhere else in v2.0. If purchase data for the
as-of date has changed since the forecast was stored (different latest-month price), the row carries the note
*"Purchase data has changed since this forecast was stored. Run the forecast again."* The stored baseline is still the
figure reported.

### Worked example (checked independently in SQL)

SOL-AG-PASTE, 30-day, as of 12 Dec 2025 (November is the last complete month):

| | |
|:---|---:|
| monthly usage, Jun–Nov 2025 | 90.1667 kg |
| baseline unit cost (Nov, from the run) | 496.23 |
| forecast unit cost (stored run, 1 month) | 505.8869 |
| baseline spend | 44,743.41 |
| forecast spend | 45,614.14 |
| **projected exposure** | **870.73** |

`docs/evidence/ticket-8/independent_sql_check.sql` recomputes these from the raw tables with no application code and
matches the API response.

## Roll-ups

Exposure is rolled up **by material** (the table), **by supplier**, **by product / SKU** and **by category**. Each
material's figures are spread over the groups by *shares that add up to 1*, so every roll-up adds back exactly to the
sum of the materials (tested):

| Roll-up | Share of a material's figures |
|:---|:---|
| Supplier | Each supplier's share of the material's purchased quantity in the usage window. Purchase lines without a supplier are *Unassigned*. |
| Product / SKU | BOM quantity × recent actual production volume, for products whose BOM line is valid on the as-of date. Production volume is the sum of `actual_volume` of periods ending inside the usage window (from its first month to the end of its last complete month; a later, incomplete month is left out, as it is for usage). A material used by no product with production volume is *Unallocated* — never guessed. |
| Category | The material's category (*Uncategorised* if none). |

Totals are **per currency**. Currencies are never added together or converted.

## Scenarios

A scenario answers "what would exposure be **if**…". It is **not a prediction**: the response is marked
`kind: "scenario"` with the label *"Scenario — a what-if calculation, not a prediction. Nothing here is saved."*,
the screen shows a banner with that text, and the inputs are echoed back.

| Control | Effect (all percentages are plain percent) |
|:---|:---|
| Price change `p` | `scenario_unit_cost = forecast_unit_cost × (1 + p)` |
| Supplier price change `q` for supplier `S` | multiplies the unit cost by `1 + share(S) × q`: the change applies to that supplier's share of usage only |
| Demand change `d` | `scenario_usage = expected_usage × (1 + d)` |
| Delivery delay `L` days | added to the share-weighted supplier lead time |
| Stock change `i` | `on_hand × (1 + i)` (latest stock snapshot on or before the as-of date) |
| Rush-buy premium `r` | extra price paid on usage the stock cannot cover (default 0) |

```
scenario_spend    = scenario_unit_cost × scenario_usage + premium_cost
scenario_exposure = scenario_spend − baseline_spend
price_effect      = (scenario_unit_cost − baseline_unit_cost) × scenario_usage
volume_effect     = baseline_unit_cost × (scenario_usage − expected_usage)
(without a premium)   scenario_exposure = price_effect + volume_effect
change_vs_baseline    = scenario_exposure − projected_exposure
```

The price and volume effects are shown so each scenario figure can be traced to its cause. Demand changes the volume
effect even at flat prices.

**Supply cover.** `cover_days = stock ÷ daily usage` (daily usage = monthly usage ÷ 30.42). `uncovered_days =
max(0, lead_time + delay − cover_days)`. The **premium** is charged only on the *additional* uncovered quantity the
scenario creates compared with today's position, so a material that is already short is not blamed on the scenario. The additional quantity is also capped at the scenario usage of the horizon, so a very long delay cannot charge a premium on more units than are used.
With the premium at 0, delays and stock changes show up in the cover figures only and add no money — TRIS does not
invent a price for being short of stock. If a stock snapshot or lead time is missing, cover is reported as *not
evaluable* with a note, and no premium is added.

Valid ranges are enforced by the server (for example price −90% to +500%); unknown controls, out-of-range values, an
unknown horizon, and a supplier with no recent purchases of the materials analysed are rejected (422) and nothing is
calculated.

### The baseline is never changed

A scenario cannot alter the stored prediction, by construction and by test:

1. `exposure_engine.py` is pure: it imports no database code and only receives plain values.
2. `exposure_service.py` only reads; a test fails if it ever contains an add, flush, commit, delete, insert or update.
3. A runtime test records every SQL statement a scenario request sends and requires that none is a write (with a
   control showing the recorder does see writes).
4. `forecast_runs` rejects UPDATE and DELETE at the database (trigger from Ticket 7).
5. `test_scenario_does_not_mutate_baseline_forecast` snapshots every stored forecast row as text, runs ten scenarios
   (extreme values included) plus one rejected request, and requires the snapshot — and its SHA-256 — to be identical,
   and the forecast and exposure API responses to be unchanged.

`docs/evidence/ticket-8/` holds the same check on the development data: `baseline_forecast_runs_BEFORE.jsonl` and
`..._AFTER.jsonl` (45 rows, 125,441 bytes each), identical checksums, and the empty diff.

Scenarios are calculated per request and are not stored. They are open to every role that can see the Manufacturing
section (including read-only reviewers) because they change nothing; running a forecast, which stores a run, still
needs an admin or reviewer.

## Limitations

- **Usage is a proxy.** Purchased quantity over 6 months is not consumption; irregular purchasing, stock-building and
  seasonality distort it. Source-system demand forecasts and production plans are not used for usage yet.
- **Product roll-up needs production data.** Without `actual_volume` records, product exposure is *Unallocated*.
- **Whole-window pricing.** Every unit in the window is priced at the monthly forecast; purchases already contracted
  or already in stock at older prices are not separated out. Exposure measures cost movement, not cash timing.
- **Forecast uncertainty is not carried through.** Exposure uses the point forecast; the prediction band is not
  converted into an exposure range.
- **Scenario simplifications.** Controls act on the whole material (supplier price excepted), lead time is the
  share-weighted latest supplier figure, and the rush-buy premium is a user-chosen number, not an estimate.
- **No currency conversion.** Each currency is reported separately.
- **Synthetic data.** Figures on the sample dataset demonstrate the method, not real company exposure.
