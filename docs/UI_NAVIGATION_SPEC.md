# TRIS v2.0 — UI Navigation Specification

Screens, navigation, who sees what, and the key action on each page. Screenshots of every manufacturing screen are
in `docs/evidence/ticket-13/screenshots/` (index in `docs/evidence/ticket-13/SCREENSHOT_CHECKLIST.md`).

The manufacturing screens are part of the existing TRIS shell (left navigation, top bar, page header). They are not a
second application. The shell, sign-in page and v1.4 pages are unchanged.

## 1. Navigation

Left sidebar, two groups:

| Group | Entry | Route | Visible to |
|:---|:---|:---|:---|
| Core modules | Dashboard | `/` | all signed-in roles |
| | Risk Cases | `/risk-cases` | all signed-in roles |
| | Suppliers | `/suppliers` | all signed-in roles |
| | Data Ingestion | `/ingestion` | all signed-in roles (v1.4 workbook ingestion) |
| | Access Events | `/zero-trust` | all signed-in roles |
| **Manufacturing** | Material Cost Intelligence | `/manufacturing/material-cost` | admin, reviewer, read-only reviewer |
| | ERP/BOM Data Mapping | `/manufacturing/erp-mapping` | admin, reviewer, read-only reviewer |
| | Forecasting & Scenarios | `/manufacturing/forecasting` | admin, reviewer, read-only reviewer |
| | Validation | `/manufacturing/validation` | admin, reviewer, read-only reviewer |
| | Case Studies / Results | `/manufacturing/case-studies` | admin, reviewer, read-only reviewer |
| | Administration | `/manufacturing/administration` | **admin only** |
| Footer | Settings & Governance | `/dashboard/settings` | signed-in users (user administration for admin) |

`/manufacturing` redirects to Material Cost Intelligence. Other roles (verifier, process owner) do not see the
Manufacturing group and, if they open a manufacturing address directly, see a "no access" state that does not name the
section; the backend also refuses their requests. Every manufacturing page has the same states: loading, empty
(no data yet), error, success, not enough data, and no permission.

## 2. Roles on the manufacturing screens

| Role | Can see | Can do |
|:---|:---|:---|
| Administrator | everything | everything below, plus the Administration page: switch forecast models on or off, save risk weight versions, label datasets, delete saved mappings, read the audit log |
| Risk reviewer | everything | import files, run forecasts, calculate risk scores, open material cases, run validations |
| Read-only reviewer | everything | nothing that writes: the buttons that run, import, calculate or open a case are not shown, and the backend refuses the calls |
| Verifier / process owner | no manufacturing section | unchanged v1.4 case work (a verifier closes cases, including material cases) |

## 3. Pages

### Material Cost Intelligence — `/manufacturing/material-cost`
Purpose: one row per material with price trend, deviation from standard cost, spend, stock cover, signals and risk
score. Filters: search, category, supplier, product, signal, dataset, date. Key actions: **Calculate risk scores**
(reviewer/admin); click a row to open the **material detail** panel: price series, supplier spend, every signal with
its explanation, the **risk score with each factor's points and plain-language reason**, and **Open a case** when the
latest stored score is High or Critical (or a link to the open case). Shows the data date, the calculation time and
currency per row (euro and dollar rows are never added together).

### ERP/BOM Data Mapping — `/manufacturing/erp-mapping`
Purpose: bring a CSV or Excel file into the canonical schema. Three steps: **1 Choose data** (what the file contains,
layout: Generic, SAP-style demonstration, Dynamics-style demonstration, saved profile; file), **2 Match columns**
(one row per canonical field, required/optional, example value, fixed value if no column; worksheet picker for Excel;
dataset name and duplicate handling), **3 Results** (rows read, imported, rejected, duplicates, blanks, warnings,
missing values, error log with CSV download). Key actions: **Check file** (dry run, saves nothing), **Import**,
**Save mapping** (admin). The page states that nothing connects to an ERP system.

### Forecasting & Scenarios — `/manufacturing/forecasting`
Two tabs. **Price forecast**: pick a material; 30- and 90-day outlook cards (value, 80% range, model); chart of monthly
history with the forecast; "How this forecast was made" (model, dataset version, history used, why this model, the
models compared on held-out months). Key action: **Run again** (stores a new run; earlier runs are kept). A horizon the
history cannot support shows why instead of a number. **Exposure & scenarios**: spend at latest and forecast prices,
projected exposure per material, roll-ups **by supplier / by product / by category**, and the **what-if scenario**
form (price change, demand change, delivery delay, stock on hand, rush-buy premium, one supplier's price). A scenario
is labelled as such and is never saved.

### Validation — `/manufacturing/validation`
Purpose: check, for past dates, what TRIS would have forecast and warned about. **Run a validation** form (outlooks,
risk-event size, warning score, months between dates, note), the list of every run (including runs that did not
finish, with the reason), and for the chosen run: results per outlook (typical error, direction, comparison with "the
price stays the same", warning quality table, advance warning, per material), problems and gaps (false alarms, missed
events with forecast move against actual move, cases withheld or not yet evaluable) and the limitations.

### Case pages — `/risk-cases`, `/cases/{id}`
Material cost cases appear in the ordinary case list and open on the ordinary case page, with a **Why this case was
opened** panel (the stored score and its factors), forecast horizon and exposure when opened, recurrence by supplier or
material, and the unchanged tabs: Investigation, Corrective Action, Closure, Historical Replay, History, Recurrence.

### Case Studies / Results — `/manufacturing/case-studies`
A placeholder page ("coming soon"). The case study itself is `docs/CASE_STUDY_01.md`.

### Administration — `/manufacturing/administration` (administrators only)
Five tabs. **Models & settings**: every forecast model with its version and kind, a switch for each regression model
(the three baselines cannot be switched off; a switched-off model is not used for new forecasts or validations; earlier
forecasts keep theirs; every change is recorded with who and when), and the fixed forecast settings. **Risk weights**: the
nine factor weights and the three band thresholds as a form that saves a **new version** (weights must add up to 100,
bands must increase, a reason is required); the version history with who saved each and why. **Datasets**: each named
dataset with its record counts and date range and a statement of whether it is synthetic or authorised data (starts as not
labelled). **Saved mappings**: the saved column mappings, with delete. **Audit log**: a read-only, filterable (what
happened, who, dates) and paged trail of imports, mapping and weight changes, forecast, scoring and validation runs,
opened material cases, model switches, dataset labels, rule edits and sign-ins. Other roles do not see the page in the
menu and get the no-access state if they open the address; the backend refuses their requests.

### Settings & Governance — `/dashboard/settings`
v1.4: detection rule weights and switches (R-001 to R-007), account profile, user administration (admin). Manufacturing
configuration is on the Administration page.

## 4. Copy rules that apply everywhere

Plain labels (Sign in, Import, Run again); no database, endpoint or library names; unfinished features carry a
"Coming soon" badge; synthetic data is labelled as such; a result shows its model version, dataset version and the
time it was calculated; missing data shows a reason and never a plausible-looking number.

## 5. Known inconsistencies

- The Forecasting, Exposure and Validation pages use "all data" and have no dataset picker; only the Material Cost
  page can narrow to one dataset.
- The Compliance page (`/compliance`) shows static sample figures and a sample audit trail from v1.x; it is not
  connected to real events.
