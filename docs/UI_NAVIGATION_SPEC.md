# TRIS v2.0 — UI Navigation Specification

Screens, navigation, who sees what, and the key action on each page. Screenshots of every manufacturing screen are
in `docs/evidence/ticket-13/screenshots/` (index in `docs/evidence/ticket-13/SCREENSHOT_CHECKLIST.md`).

The top bar carries an **Evaluation · Synthetic data** label on every page. The Material Cost page shows the dataset and the
data date in its summary; the other manufacturing pages use all data.

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
Purpose: one row per material with price trend, deviation from standard cost, spend, stock cover, signals, risk
score and the stored 30- and 90-day forecasts and 90-day projected exposure ("Not run" where none is stored).
Filters: search, category, supplier, product, signal, **risk level**, dataset, date. **Export table (CSV)** saves exactly
the rows shown, with plain numbers (no display formatting), the stored forecasts and exposure, the signals and the data date. Key actions: **Calculate risk scores**
(reviewer/admin); click a row to open the **material detail** panel: price series, supplier spend, every signal with
its explanation, a **Forecast and exposure** section (30- and 90-day value, range, model name and version, forecast
date, dataset version, and the 90-day exposure, all read from stored runs), the **risk score with each factor's points and plain-language reason**, and **Open a case** when the
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

### Welcome, tour and help (every page with the TRIS shell)
- **Welcome.** After the first sign-in in a browser, the dashboard opens a **Welcome to TRIS** dialog: what TRIS does, a **What is new**
  list (for roles that see the Manufacturing section; other roles get a short line about cases), and a note that all data is synthetic.
  Buttons: **Take a quick tour** and **Skip for now**. It appears once per browser (not once per role, so a tester switching demo roles
  is not shown it again); if the browser blocks storage it may appear again. It carries no version number.
- **Help button** in the top bar: **What is new** reopens the welcome, **Take the tour** starts the tour.
- **Tour.** Up to ten steps outlining one element at a time (dashboard summary, the Manufacturing menu and its four working pages in
  order, Administration for administrators, Risk Cases, the account menu, Help). Steps whose element is not on screen, or not
  allowed for the role, are left out. Next, Back and Skip; Right and Left arrows, and Escape to leave; Tab stays inside the card and focus goes back to where it was. If the highlighted element disappears (for example the window is made narrow) the tour moves on or ends. Nothing is saved or changed.
- **"?" tooltips** beside terms a newcomer may not know (risk score, projected exposure, forecast, forecast range, standard cost, stock cover,
  supplier concentration, scenario, validation, weight version, risk trend). They open on hover or keyboard focus; the wording lives in
  `components/onboarding/glossary.ts` and says only what the system does.

### Sign-in page — `/login`
Email, password, show/hide, Remember me, Forgot password, the evaluation-environment label. On a demonstration deployment
(`DEMO_LOGIN_ENABLED=true`) a **Demo environment: sign in as** panel offers one button per role with a line on what the
role can do; the user menu then has **Switch demo role**, and the Administration page warns that changes are shared. With the
switch off, none of these appears. Five failed sign-ins for the same typed identifier (a username and an email are counted separately) pause sign-in for that identifier for 15 minutes ("Too many attempts"); a successful sign-in does not reset the count.

### Dashboard — `/` (manufacturing summary)
Below the existing risk overview, for admin, reviewer and read-only reviewer only (other roles see the dashboard as
before): four cards (**High-risk materials**, **Projected material-cost exposure, next 90 days**, **Materials with a
30-day forecast increase**, **Supplier concentration exposure**), a **Material-cost risk trend** bar chart and a **Top
materials by projected exposure** table, each row linking to the material and to its open case. Definitions: high-risk
means the newest stored score is High or Critical; a 30-day increase means the stored 30-day forecast is above the last
price; supplier concentration exposure is the last 12 months' spend on materials whose "Dependence on one supplier" signal
is triggered; the trend has one bar per set of saved scores (data date and weight version). Everything is read from stored
results; amounts in different currencies are shown and ranked separately; a part with nothing stored says why instead
of showing zero.

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
- The v1.x Compliance page (`/compliance`) showed static sample figures and a sample audit trail, not real events. It
  was taken out of navigation on 2026-10-07: the route redirects to the dashboard and the user menu no longer links to it.
