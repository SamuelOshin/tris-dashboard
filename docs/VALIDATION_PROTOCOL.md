# TRIS v2.0 — Retrospective Validation Protocol

How **Manufacturing → Validation** checks, for past dates, what TRIS would have forecast and warned about using only the
data it had then, and what actually happened (decision D5). Method version **1.2** (see *Method versions* below).

Code: `backend/app/api/modules/v1/manufacturing/service/` — `validation_service.py` (the protocol),
`validation_metrics.py` (pure calculations), `validation_types.py` (settings). Tables: `validation_runs`,
`validation_cases`, `validation_outcomes`, `validation_summaries`, `validation_failures`. Endpoints: `/api/v1/manufacturing/validation/...`.
Tests: `test_validation_protocol.py`. Results of real runs: `VALIDATION_RESULTS.md`.

## The protocol, in order

| Step | What happens | Where it is enforced |
|:---|:---|:---|
| 1. Choose cutoffs | Month-end dates from the first date with enough history (13 months for the 30-day outlook) to the last whose shortest holdout month is complete. The list depends only on the data span and the settings (`cutoff_schedule`). | A unit test; the cutoffs are stored with the run. |
| 2. Use only prior data | Every record is loaded with a date limit **in the database query** (`load_material_data(cutoff)`): purchases, stock, costs, variances, supplier metrics and bill-of-materials lines that start after the cutoff are never read. Every loaded record is then checked again (`assert_no_future_records`, and `assert_no_future_bom` for the bill of materials), and the forecast engine refuses a monthly point after the cutoff. | Query layer, then two independent checks; the mandatory leakage test below. |
| 3. Fit and score | The forecast model is chosen and fitted (Ticket 7 engine, unchanged) and the risk score is calculated (Ticket 9 factors and the **active weight version**) from that data only. The score's *predicted increase* factor uses the forecast made at the cutoff, never a stored later one. | Same code as production; nothing is forked for validation. |
| 4. Forecast the holdout | The forecast for the target month (1 month ahead for 30 days, 3 for 90 days). A case whose history is too short is stored as *withheld* with the reason. | Forecast engine rules. |
| 5. Freeze | Every forecast and signal of the run is saved and **committed** before any later record is read: model, version, dataset fingerprint, last price, forecast and band, naive forecast, risk score, factors, whether the warning fired, and the time. | Order of the code; a test spies on the moment actuals are first read and finds every case already in the database and no outcome yet. |
| 6. Reveal | Only now are the holdout actuals read (`reveal_actuals` is the one function that reads records after a cutoff) — the quantity-weighted average price of the target month, in the forecast's currency. They are used to judge, never to fit. A holdout month that is not complete in the data, or has no purchases, is *not evaluable*, with the reason. | Single function; frozen rows cannot change. |
| 7. Compare | Forecast against actual for every frozen case, and the warning against whether a risk event happened. | `validation_metrics.evaluate_case`. |
| 8. Metrics | See below. | Hand-calculated in tests. |
| 9. Record failures and limitations | Withheld and not-evaluable cases, false alarms, misses and cases worse than the naive forecast are stored and shown; a limitations list is stored with every run. A run that stops early keeps its header and whatever it saved, is listed as *did not finish*, and the reason it stopped is stored with it (`validation_failures`). Nothing is ever deleted: all five tables refuse UPDATE and DELETE at the database. | Triggers; tests. |
| 10. Repeat widely | Every material at every cutoff and horizon is a case. Which cases exist never depends on how well anything did (tested: two runs with very different warning thresholds contain exactly the same cases). | Test. |

## Definitions

- **Case**: one material, one cutoff date, one outlook (30 or 90 days).
- **Actual**: the quantity-weighted average purchase price of the target month. **Naive forecast**: the last month's
  price carried forward ("the price will stay the same") — the bar a forecast has to clear.
- **Risk event**: the actual price at the target month is at least `event_threshold_pct` (default **5%**) above the
  last observed price. Chosen before the run and stored with it.
- **Warning**: the risk score at the cutoff is at least `alert_threshold`; by default the **High band** of the active
  risk weight version (so the warning means what "High" means everywhere else). A case with too little data to score
  raises no warning; such cases are counted in the results (`unscored`, and how many of them were events) so the missed count can be read correctly. A month priced at zero or below in the usable history withholds the forecast with that reason (percentage errors are undefined).
- **Flat move**: a price move smaller than `flat_band_pct` (default 0.5%) has no direction.

## Metrics

| Metric | Definition | Notes |
|:---|:---|:---|
| MAE | mean of \|forecast − actual\| | In each material's own price units; pooled values mix scales (shown per material too). |
| RMSE | square root of the mean squared error | Same caveat. |
| MAPE | mean of \|forecast − actual\| ÷ actual | Meaningful because prices are positive; the comparable accuracy figure across materials. |
| Directional accuracy | share of cases where the forecast and the actual moved the same way (up/down), among cases where **both** moved | A flat forecast ("the price will stay the same") makes no directional call: it is counted apart (*no call*), not as wrong. Cases where the actual stayed flat are not scored. Both numbers are shown. |
| Against naive | share of cases where the forecast was closer than the naive forecast, equal to it, or further | Scale-free. Errors within 1e-5 are *equal*: forecasts are stored rounded to 6 decimals, so a naive forecast is not exactly the last price. The tolerance is absolute because the rounding is absolute; on the development data (smallest price 0.2086) tightening it five times changes no count (`evidence/ticket-11/qa_fix_data_checks.txt`). |
| True/false positives and negatives | warning × risk event | Precision, recall, false positive rate, false negative rate are *not defined* (shown as a dash) when the denominator is zero, never as 0 or 100%. |
| Advance warning (lead time) | for each risk event the warning caught: months from the start of the unbroken run of consecutive cutoffs that all raised a warning to the month of the event | At least the horizon; longer means the warning came earlier and stayed on. |

## Mandatory leakage test (D5)

`test_validation_rejects_post_cutoff_data_leakage` plants a record dated after the cutoff and requires refusal at every
layer: the data-layer guard, the forecast engine, and the whole harness with the query layer made to fail (a later record
handed back as a broken date filter would). The run must stop with a data-leakage error, nothing may be forecast from the
record, and the failed run's header must remain stored and listed as *did not finish*. A second test loads an extreme
price into the final month between two runs and requires every frozen forecast and signal to be identical while the one
affected outcome changes.

## Limitations (also stored with every run)

- Neighbouring cutoffs and the 90-day outlook share history and holdout months, so cases are not independent and their
  number overstates the evidence. Using a larger gap between cutoffs reduces this.
- The event definition, the warning threshold and the weights are judgement, not fitted; changing them changes the false
  alarms and misses. Results at one setting must not be presented as the system's accuracy.
- Monthly averages only; a forecast cannot be judged inside a month.
- Few cases give rates that are only indicative (a run with fewer than 30 judged cases says so).
- Synthetic data: results show that the method works as built, not how it would perform on a real company's purchasing.

## Method versions

| Version | Change | Why |
|:---|:---|:---|
| 1.0 | First definition. | |
| 1.1 | A flat forecast makes no directional call (counted apart). The comparison with the naive forecast reports better, equal and worse separately. | The first real runs showed 18% directional accuracy: version 1.0 counted every "stays the same" forecast as a wrong direction whenever the price moved (95 of 192 judged cases came from the naive model). |
| 1.2 | Errors that differ by less than 1e-5 are equal to the naive error. | The next check showed the naive model's rounded forecasts "beating" or "losing to" the naive baseline by rounding noise (23 of 65 naive-model cases in one horizon). |

Every run records its method version. Runs made with an earlier version are kept and listed, and `VALIDATION_RESULTS.md`
explains how they differ.
