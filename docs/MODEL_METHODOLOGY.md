# TRIS v2.0 — Forecast Model Methodology

How **Manufacturing → Forecasting & Scenarios** produces a material price outlook. This document covers the
forecasting engine only. What-if scenarios and financial exposure (Ticket 8), the risk score (Ticket 9) and the
retrospective validation harness (Ticket 11) are separate and build on it.

Code: `backend/app/api/modules/v1/manufacturing/service/` — `forecast_engine.py` (scoring, selection, horizon rules),
`forecast_models.py` (the five models), `forecast_history.py` (history preparation and the no-hindsight guard),
`forecast_service.py` (database access and stored runs), `forecast_types.py` (settings).
Stored records: table `forecast_runs`. Library: `statsmodels` (decision D6), plus `numpy`.

## What is forecast

The **monthly average purchase price** of a material: Σ(quantity × unit price) ÷ Σ(quantity) over the purchase lines
of each calendar month, in the material's most common currency (other currencies are left out, never converted).
The data frequency is therefore **monthly**, and the outlooks are expressed on that grid:

| Outlook | Meaning |
|:---|:---|
| 30-day | the monthly average price one month after the last month in the data |
| 90-day | the monthly average price three months after it |

A forecast is a statement about next month's average price, not about any single purchase.

**Incomplete final month.** If the as-of date falls inside the last month of data (for example purchases up to the
12th), that month's average covers only part of the month and would be treated as a full observation. It is therefore
**left out** of the series, and the response and the screen say which month was excluded ("December 2025 is
incomplete and not used"). Choosing an as-of date at or after the last day of the month includes it. Forecasts, the
usable-history count and the dataset fingerprint all use the series without the incomplete month.

## When a horizon is shown (and when it is withheld)

A horizon is shown **only** if the history can both fit a model and score it fairly. The rule follows from the scoring
design below: every model is scored at 4 forecast origins, each with at least 9 months of training data and a real,
unseen target `h` months later, so

```
required months = 9 (training) + 4 (scoring origins) + h − 1      →  30-day: 13   90-day: 15
```

Only the latest **unbroken** run of calendar months counts. A missing month ends the run; gaps are never filled with
invented values. If the history is too short, the API returns the horizon as `withheld` with the reason, the screen
says so, and **nothing is stored** for that horizon. The 90-day outlook is withheld before the 30-day one.

## Models

| Model (version) | Kind | Forecast for `h` months ahead |
|:---|:---|:---|
| Naive (1.0) | baseline | the latest monthly price |
| Moving average, 3 months (1.0) | baseline | mean of the latest 3 monthly prices |
| Simple exponential smoothing (1.0) | baseline | smoothed level; the weight (0.05–0.95, in steps of 0.05) is chosen on the training data by one-step squared error |
| Linear trend regression (1.0) | regression (`statsmodels` OLS) | price = a + b·time over the latest ≤ 24 months, extended `h` months |
| Lagged price regression (1.0) | regression (`statsmodels` OLS) | direct `h`-step model: price(t+h) = a + b·price(t) + c·time, fitted only on pairs inside the training data |

A model that cannot be fitted (series too short for its terms, too regular to separate its terms, or a forecast that is
not a positive price) is marked ineligible with the reason and is not chosen.

## Held-out comparison and model selection

For each candidate the engine runs a **rolling origin** evaluation: at each of the last 4 origins the model is fitted
on the data *before* that origin only and asked for the price `h` months later, which it has never seen. Reported per
model: mean absolute error (MAE, used for selection), RMSE, MAPE, and how often the direction of change was right.

Selection rule (so complexity is used only when it demonstrably helps):

1. Take the best baseline by MAE.
2. A regression model is chosen **only if** its MAE is at least **10% lower** than that baseline's.
3. Otherwise the baseline is kept. Ties go to the simpler model.

The reason, with the numbers, is stored with the run (`selection_rationale`) and shown on screen. With strongly
trending data a regression usually wins; with noisy, flat or spike-and-revert data a baseline usually does. Both
outcomes occur on the synthetic dataset.

## Prediction band

A band is shown **only** for the two regression models, which have a statistical basis for one (the OLS prediction
interval, 80%). Baselines have none, so none is drawn. Caveat: the OLS interval assumes independent errors; consecutive
monthly prices are not independent and the lagged model's multi-step targets overlap, so the band is approximate and
probably somewhat too narrow.

## No hindsight (decision D5)

The as-of date (cutoff) is applied in the database query that loads purchases, and the engine checks again: a history
point dated after the cutoff is **rejected with an error**, not trimmed. Scoring fits each model on `y[:origin]` only. A
stored forecast made at a cutoff does not change if later purchases are loaded (tested). The mandatory test is
`test_validation_rejects_post_cutoff_data_leakage`.

## Stored runs, versions and reproducibility

Every forecast produced is stored as an **immutable** row in `forecast_runs`; a re-run adds a new row and never edits
an earlier one. Immutability is enforced twice: the service has no update or delete path, and a database trigger
(`trg_forecast_runs_immutable`) refuses any UPDATE or DELETE on the table. Each row records: material, as-of date, currency, horizon (days and months), model code/name/**version**,
**dataset version** (a SHA-256 fingerprint of exactly the series, cutoff and currency the model saw), history length and
dates, the forecast point and path, the band and its level, every candidate's held-out scores and parameters, the
selection rationale, the settings used, who ran it and when. The same data and settings always give the same forecast
and the same fingerprint (tested); changing a price or the currency changes the fingerprint.

A stored run belongs to the dataset scope it was made for (all data, or one named dataset): reading forecasts for one
scope never shows a run made for another. The run history list shows every run unless a dataset is given. A material
with no purchases up to the chosen date is reported as not found rather than as an empty forecast.

## Limitations

- **Monthly resolution.** Intra-month moves are invisible; "30 days" means next calendar month's average.
- **Few scoring points.** Selection rests on 4 held-out months per model. It is a guide, not a significance test, and a
  model can win by chance. The 10% threshold reduces, not removes, that risk.
- **Univariate.** Only the material's own price history is used: no demand, inventory, supplier, commodity-index or
  seasonal terms (there is too little data per material for seasonal estimation, and no legitimate external driver
  source exists in this prototype).
- **Spikes and regime changes** (a supplier change, a one-off shock) are not anticipated; regression models extrapolate
  trends and can overshoot after a reversal.
- **Not a prediction of risk.** A forecast price is an input to exposure and scoring in later tickets, not a risk verdict.
- **Synthetic data.** Results on the sample dataset demonstrate the method; they are not evidence of accuracy on real
  company data. Retrospective accuracy measurement across many materials and periods is Ticket 11.

## Configuration

Defaults in `ForecastConfig`: 9 training months, 4 scoring origins, 10% required improvement, 80% band, 3-month moving
average, regression window of the latest 24 months, horizons 30 and 90 days. They are recorded in each run.
