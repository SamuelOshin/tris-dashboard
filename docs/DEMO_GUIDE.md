# TRIS v2.0 — Demo Guide: from sign-in to validation

How to run a demonstration of the Material Cost Intelligence extension, in about 20 minutes, without overstating what
it does. The full, checkable walkthrough with every expected figure is `CASE_STUDY_01.md`; this guide is the
presenter's route through it.

**Everything shown is synthetic.** The sign-in page says so; say so too.

## 1. Before the demo (10 minutes, once)

Follow section 0 of `CASE_STUDY_01.md` to create an **empty database**, the demo accounts and suppliers, start the
backend (port 8000) and the frontend (port 3000). Then load the data one of two ways:

- **Fast:** `cd backend && uv run python -m app.scripts.case_study --check` loads Environment A, runs every step and
  confirms the figures. (This also opens and closes one case for SOL-CELL-M10; it leaves a closed case to show.)
- **Live:** import the files on screen during the demo (CASE_STUDY_01 step 1).

For the transferability part, also have `docs/samples/environment_b/environment_b_industrial.xlsx` ready.

**Signing in as a role.** On a demonstration deployment set `DEMO_LOGIN_ENABLED=true` (off by default; see
`backend/.env.example`). The login page then shows **Demo environment: sign in as** with one button per role
(Administrator, Risk reviewer, Read-only reviewer, Compliance verifier, Process owner), and the user menu has **Switch
demo role**, so a tester can move between roles without signing out. No password is typed or shown anywhere: the server
signs the visitor in as the seeded demo user, and each use is written to the audit log as a demo sign-in. A normal
deployment (flag off) shows no panel and the endpoint answers "not found". Because the switch needs no password, enable
it only where the data is synthetic. Run the seed script once on the deployed database so the demo users exist (it adds
the read-only reviewer to an older seeded database; it skips users that are already there).

Without the switch, use the demo accounts defined in `backend/app/scripts/seed.py` and share their passwords outside the
repository. Never reuse them elsewhere.

## 2. The route (about 20 minutes)

| Minutes | Screen | Show | Say |
|:---|:---|:---|:---|
| 1 | Sign in | The "Evaluation environment · Synthetic test data only" line | All data is synthetic. |
| 2 | Dashboard | The existing v1.4 workspace, then the **Material cost intelligence** summary: high-risk count, projected exposure, 30-day increases, supplier concentration, risk trend, top exposures | The manufacturing section sits inside the same application; the case workflow is the same. Every figure is a stored result, and a part with nothing stored says so. |
| 3 | Manufacturing → ERP/BOM Data Mapping | Upload the Environment B workbook, choose the **Parts** sheet: every field reads "Not matched". Match four columns by hand, **Check file**, **Import** | Nothing here recognises these column names, so the mapping is configuration. It is a file upload, not a connection to an ERP system. |
| 4 | Material Cost Intelligence | The six Environment A materials, signals, filter by dataset; switch to Environment B | Same page, different dataset, euro and dollar shown separately. |
| 3 | Open SOL-CELL-M10 | Price vs standard cost, supplier concentration, the **risk score and each factor's reason** | Every point of the score is explained; nothing is a black box. |
| 3 | Forecasting & Scenarios | The 30/90-day forecast with its range and **why this model was chosen**; **Run again** adds a run, it never replaces one | The model, version and data fingerprint are stored with every forecast. |
| 2 | Exposure & scenarios | Exposure by product; scenario price +10% | A scenario is a calculation, labelled as one, and never changes the stored forecast. |
| 3 | Open a case | **Open a case** on a High material; the case page's "Why this case was opened"; the History tab | The signal enters the existing governed workflow: the investigator cannot close their own case; a verifier closes it with evidence. |
| 1 | Administration (admin only) | Switch a regression model off and on; the Audit log tab shows the change, who made it and when | Nothing is changed silently: every configuration change and run is recorded and cannot be edited. |
| 4 | Validation | Run with the defaults; read the 30-day results; open the false alarms and missed events | It goes back in time using only what was known then and keeps the failures. **Say what it found:** the forecasts were not better than assuming the price stays the same, and the warning missed or falsely raised as many as it caught. |

## 3. What to say about accuracy

Use the numbers on screen and these limits: six materials, overlapping dates, synthetic prices, a risk event defined
as a 5% rise, and a warning level that was set on the same data. Do **not** quote the figures as accuracy, do not
claim savings or avoided cost, and do not call the forecasts or the warning reliable. The honest result is that the
method works as built and that on this data it adds no demonstrated skill over a no-change assumption.

## 4. Things to be ready for

- **"Is it connected to SAP?"** No. The SAP-style and Dynamics-style options are layouts of an uploaded file.
- **"Where is the audit log?"** **Manufacturing → Administration → Audit log** (administrators): imports, runs,
  weight changes, model switches, dataset labels, opened cases and sign-ins, filterable, with who and when. The Compliance
  page is different: it shows static sample content, not real events; do not show it as an audit log.
- **"Can I change the risk weights?"** Yes, on **Administration → Risk weights**: edit the weights and bands, give a reason
  and save a new version; earlier versions and scores stay as they were.
- **"Where are the forecast and the exposure?"** On the Forecasting & Scenarios page; the Material Cost table shows
  prices, signals and risk scores only.
- **A read-only reviewer** sees all results but none of the buttons that run, import, calculate or open a case.

**Labels.** The login page and the top bar say this is an evaluation environment with synthetic data. A deployment that holds
real data sets `NEXT_PUBLIC_EVALUATION_LABEL=off` for the frontend.

## 5. Resetting

With demo sign-in on, anyone can act as administrator (switch models off, save risk weights, label datasets), and the next
tester sees the result. The Administration page says so. Before a review, reset to a known state.

Create a new empty database (section 0 of `CASE_STUDY_01.md`) rather than deleting rows; stored runs, scores and
case history are protected against edits and deletion by design.
