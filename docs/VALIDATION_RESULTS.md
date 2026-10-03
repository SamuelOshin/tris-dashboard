# TRIS v2.0 — Retrospective Validation Results

Real runs of the retrospective validation protocol (`VALIDATION_PROTOCOL.md`) on the development data. All runs are stored
(`validation_runs` and related tables; the API responses are in `docs/evidence/ticket-11/live_runs/`). **Nothing here has
been selected for looking good**: the runs that exposed mistakes in the method itself are listed first and kept.

## The data and the setup

- 13 materials with monthly purchases from January 2024 to 12 December 2025 (the synthetic solar-component sample).
  **Six of the 13 are duplicate entries of the same series** (the SAP-style import of the same materials), so the cases
  below come from about seven independent price series, not thirteen. Their results are identical in pairs.
- Cutoffs: 31 January to 31 October 2025 (10 month-ends; the 30-day outlook needs 13 months of history, and November is
  the last complete holdout month). 260 cases per run (13 materials × 10 cutoffs × 2 outlooks).
- Risk weights **version 2** were active (the High band lowered from 50 to 40 to show cases in Ticket 10), so the default
  warning threshold in these runs is **40**, not 50.
- Risk event: the actual monthly price at the target month is at least **5%** above the last observed price.

## Runs, in the order they were made

| Run | Method | Settings | What it showed |
|:---|:---|:---|:---|
| VAL-4C75719443 | 1.0 | defaults | Directional accuracy **18%** — below a coin flip, which is not believable for forecasts that were close in price (MAPE 3%). Investigated: 95 of the 192 judged cases came from the naive model, whose forecast is "the price stays the same"; version 1.0 scored that as a wrong direction whenever the price moved. **A flaw in the metric, not in the forecast.** |
| VAL-7658D0A331 | 1.0 | warning at 25 | Same flaw. |
| VAL-25768D469C | 1.0 | cutoffs 3 months apart | Same flaw. |
| VAL-EBEA9EB217 | 1.1 | defaults | Direction fixed (flat forecasts counted apart). The "beats the naive forecast" figure was still wrong: the naive model's forecasts are stored rounded to 6 decimals, so 23 of its 65 cases at the 30-day outlook "beat" or "lost to" the naive baseline by about 0.0000003. **Another flaw in the method.** |
| VAL-7796C14E7C, VAL-1859BC82B7 | 1.1 | warning at 25; 3-month gaps | Same flaw. |
| VAL-ADAD96F982 | 1.1 | defaults | Same results as VAL-EBEA9EB217 with the withheld-case reasons grouped. |
| **VAL-DDE132A295** | **1.2** | **defaults (reference)** | The results below. |
| VAL-79274BB00A | 1.2 | warning at 25 | Sensitivity of the warning. |
| VAL-6AB7B1E298 | 1.2 | cutoffs 3 months apart | Less overlap between cases. |

The earlier runs are not deleted and are marked with their method version. Their forecast figures (MAPE, error) are
unaffected; only the direction and naive-comparison figures differ.

## Results of the reference run (VAL-DDE132A295, method 1.2)

192 cases were judged: 120 at the 30-day outlook and 72 at 90 days. 44 cases were withheld because the history was too
short to forecast (10 at 30 days, 34 at 90 days) and 24 90-day cases have a holdout month that is not in the data yet.

| | 30-day outlook | 90-day outlook |
|:---|---:|---:|
| Typical error (MAPE) | 3.1% | 5.5% |
| MAE: forecast vs "the price stays the same" (mixed price units) | 0.113 vs 0.096 | 0.238 vs 0.178 |
| Forecast closer / equal / further than "stays the same" | 18% / 54% / 28% | 26% / 42% / 32% |
| Direction right (cases where both moved) | 44% of 43 | 43% of 35 |
| "No change" forecasts while the price moved | 64 | 33 |
| Risk events (price rose ≥ 5%) | 16 of 120 (13%) | 24 of 72 (33%) |
| Warning at score ≥ 40: correct / false alarms / missed / correct (no event) | 5 / 17 / 11 / 87 | 8 / 11 / 16 / 37 |
| Precision / recall | 23% / 31% | 42% / 33% |
| False alarm rate / miss rate | 16% / 69% | 23% / 67% |
| Advance warning of the events caught | 5 events, 1.4 months on average | 8 events, 3.9 months on average |
| Models chosen | Naive 65, Moving average 23, Linear trend 16, Lagged price 12, Exponential smoothing 4 | Naive 30, Lagged price 19, Linear trend 13, Moving average 8, Exponential smoothing 2 |

Per material and the full lists of false alarms and misses (28 false alarms, 27 misses across both outlooks) are in
`run_H_reference_v1_2.json` and the `..._cases_false_positives.json` / `..._cases_false_negatives.json` files, and on the
Validation page.

### What this says, plainly

1. **The forecasts did not beat the simplest alternative.** Where a model differed from "the price stays the same", it was
   further from the real price more often than closer (30 days: of 55 such cases, 22 closer and 33 further), and the
   average error is higher than the naive one at both outlooks. More than half of the cases ended up using the naive model
   anyway. The forecasts are still usable as a rough guide (typical error 3–5%), but the data gives no evidence that they
   add skill over assuming no change. The model-selection rule of Ticket 7 (a model must beat the baselines on four
   held-out months) was not enough to pick models that held up on later months.
2. **Directional calls were not better than chance** (44% and 43% on the cases where a direction was called).
3. **At the default warning level the risk score caught few events.** It found about a third of the price rises
   (31% and 33%) and most of its alerts were wrong at the 30-day outlook (precision 23%, against 13% of cases being events,
   a little under twice as good as warning at random). At the 90-day outlook precision was 42% against 33% events.
4. **Making the warning more sensitive does not rescue it.** At a threshold of 25 (VAL-79274BB00A) recall rose to 88% and
   92%, but it warned in 103 of 120 cases at the 30-day outlook (false alarm rate 86%): a warning raised almost all the
   time says very little.
5. **When the warning did fire early it fired early enough to matter** (events caught were warned about 1.4 months ahead at
   the 30-day outlook and 3.9 months at 90 days on average), but there were few such events (5 and 8).
6. **Spacing the cutoffs three months apart** (VAL-6AB7B1E298) gave the same picture on fewer cases (precision 25%/60%,
   recall 33%/38%).

## Limitations of these results

- **Few independent cases.** About seven independent series, overlapping cutoffs and horizons, and 5 or 8 caught events
  per outlook: the rates above carry wide uncertainty and must not be quoted as accuracy.
- **The data is synthetic.** The price movements were generated, so the results say nothing about real purchasing.
- **Choices not fitted to these results, but not blind either:** the 5% event threshold was set before the first run. The warning level (40 here, from weights version 2) and the weights were set in Ticket 10 by looking at the same data (the High band was lowered from 50 to 40 so that cases would show), and that data includes the holdout months. That can only flatter the warning, and the results are poor anyway; but the threshold is not a clean out-of-sample choice. The 5% event threshold, the warning level
  and the weights themselves. Other reasonable choices give different false alarm and miss counts (see the 25 run).
- **Two mistakes in the method were found by looking at implausible results and were fixed (1.0 → 1.1 → 1.2).** Both
  changed how forecasts were *judged*, not the forecasts or the risk scores, and the stored forecasts and signals of all
  runs are identical. There may be other flaws that did not produce a visibly implausible number.
- **Not tested here:** transferability to other data (Ticket 12), supplier-specific or demand-driven events, and any real
  cost outcome beyond the monthly average price.
