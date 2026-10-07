# Case Study 01 — A rising cell price, from files to a validated result

A complete, reproducible walk through TRIS v2.0 on the synthetic **Environment A** data (a solar-panel manufacturer,
2024–2025). It follows one material, **Monocrystalline cell M10 (`SOL-CELL-M10`)**, from an uploaded file to a closed risk case,
and then checks how well the forecasts and warnings would have worked in the past.

**All data is synthetic.** The figures say what the software does with this data; they say nothing about a real
company. Every number below is produced by the software and is checked by an automated test
(`backend/tests/modules/v1/test_case_study_reproducible.py`) against `docs/case_study/CASE_STUDY_01_expected.json`.

## What you will get

Two ways to follow it, with the same result:

- **Path A, one command (about two minutes):** the script `app.scripts.case_study` performs every step through the
  API and prints the figures; with `--check` it confirms each one matches this document.
- **Path B, on screen (about an hour):** the same steps in the browser, with the figures to expect at each step.

Do Path A first to confirm your installation, then Path B to see it.

## 0. Prerequisites

Docker, Python 3.12+ with `uv`, Node with `pnpm`, and the repository checked out on branch
`v2.0-manufacturing-extension`. Commands are for a terminal in the repository folder.

**An empty database is required** (the figures assume nothing else is loaded). To use a separate database
(example name `tris_case_study`):

```bash
docker compose up -d postgres
docker exec tris_postgres psql -U tris_user -d postgres -c "create database tris_case_study"
```

Point the backend at it by setting `DATABASE_URL` once in the shell you use for the backend. The migration step,
the seed step and the server must all run in a shell where it is set. In bash:

```bash
export DATABASE_URL="postgresql+psycopg://tris_user:tris_password@localhost:5433/tris_case_study"
```

(In PowerShell: `$env:DATABASE_URL = "postgresql+psycopg://tris_user:tris_password@localhost:5433/tris_case_study"`.)

Run these four commands **in order, one at a time** (the second creates the tables, the third creates the demo
accounts; skipping the third makes every sign-in fail with `401 Unauthorized`):

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.scripts.seed --data-file "../test data.xlsx" --temporal-fixture
uv run fastapi dev app/main.py --port 8000
```

The seed step ends with `TRIS Database Seeding & Ingestion Succeeded!`. If it does not, stop and fix that first.

The server is ready when http://localhost:8000/docs opens (the first start takes up to a minute). Leave the backend
running. On Windows, if you start it in the background with its output redirected to a file, first set
`PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`, otherwise it can stop with a `UnicodeEncodeError`; an ordinary
interactive terminal does not need them. To use another port, change `--port` here and pass
`--base-url http://localhost:<port>` to the script below (the default is port 8000).

For Path B also start the screens in a second terminal:

```bash
cd frontend
pnpm install
pnpm run dev
```

The demo accounts (reviewer, verifier, admin, …) are the ones the seed step prints and defines in
`backend/app/scripts/seed.py`. Sign in with the **Email** shown there. Do not reuse these accounts anywhere real.

## Path A — one command

In a third terminal (the script only calls the running backend, so `DATABASE_URL` is not needed here):

```bash
cd backend
uv run python -m app.scripts.case_study --check
```

It takes roughly one to two minutes, prints each step and ends with `CASE STUDY REPRODUCED: every figure matches`. If a figure differs it lists it
instead and exits with an error. Running it twice on the same database is not meaningful: it imports the files again
(rows already there are skipped), stores more runs and adds a second weight version. To repeat, use a new empty
database (section 0).

The steps below are the ones the script performs; Path B does them by hand.

## The story, step by step

### Step 1 — Bring the data in (ERP/BOM Data Mapping)

Seven sample files in `docs/samples/erp_mapping/` (all `generic_*.csv`; not the `_72c`, `_short_history`,
`_secondary`, `sap_style_*` or `dynamics_style_*` variants), in this order, because later files refer to earlier ones:
`generic_materials.csv` (Material master), `generic_purchases.csv` (Purchase records), `generic_inventory.csv`
(Inventory), `generic_bom.csv` (Bill of materials), `generic_material_costs.csv` (Material costs),
`generic_supplier_ops.csv` (Supplier operations), `generic_production.csv` (Production volume).

On screen: **Manufacturing → ERP/BOM Data Mapping**. For each file: choose what it contains, keep the **Generic
CSV / Excel** layout, choose the file, **Read file** (TRIS suggests every match; nothing needs changing), type the
dataset name `Synthetic Environment A`, **Check file** (a dry run that saves nothing), then **Import**.

Expected: every import completes with no rejected rows.

| File contents | Rows imported | Rows rejected |
|:---|---:|---:|
| materials | 6 | 0 |
| purchase records | 144 | 0 |
| inventory records | 18 | 0 |
| bom entries | 6 | 0 |
| material costs | 12 | 0 |
| supplier operations metrics | 84 | 0 |
| production records | 12 | 0 |

(Screenshots: `docs/evidence/ticket-13/screenshots/05a…`, `05b…` and `06…` show the same screens for the second
environment.)

### Step 2 — See what moved (Material Cost Intelligence)

**Manufacturing → Material Cost Intelligence** now lists 6 materials. Open **SOL-CELL-M10**.

Expected: latest price **0.2684** against a standard cost of **0.2196**
(**+22.22%**); price up 0.22% over three months; one supplier (SUP-004)
supplies **100%** of spend; stock covers **20 days**. Two
signals are triggered: **standard cost deviation and supplier concentration**. The other eight checks are clear,
each with its explanation. (`screenshots/03…`, `04…`)

### Step 3 — Forecast (Forecasting & Scenarios → Price forecast)

For each material choose it and press **Run again** (it stores a forecast for 30 and 90 days). That makes
12 stored forecasts for 6 materials.

Expected for **SOL-CELL-M10** (the model chosen is *Lagged price regression*, version 1.0, last price 0.2798):

| Outlook | Forecast | 80% range | Change vs latest |
|:---|---:|:---|---:|
| 30 days (Dec 2025) | 0.2823 | 0.2754 to 0.2893 | +0.9% |
| 90 days (Feb 2026) | 0.2891 | 0.2805 to 0.2976 | +3.31% |

Note the two "latest prices": step 2 shows the latest purchase (0.2684, December 2025), but December is an incomplete month
in the data, so forecasts and exposure start from the last **complete** month, November (0.2798). The page says so
("Dec 2025 is incomplete and not used").

The page also shows why this model was picked (it beat the best simple baseline on the four held-out months) and the
other models it was compared with. (`screenshots/07…`)

### Step 4 — What it costs (Forecasting & Scenarios → Exposure & scenarios)

Choose the **90-day outlook** and all materials.

Expected for **SOL-CELL-M10**: baseline unit cost **0.2798**, forecast unit cost
**0.2856**, expected usage **56,989.5** units (from the last six months of
purchases), projected exposure **$332.48**. By product, all six materials belong to
PANEL-60C. (`screenshots/09…`, `10…`)

Now the **What-if scenario**: price change **10%**, **Show scenario**. Expected for SOL-CELL-M10: unit cost
**0.3142**, scenario exposure **$1,960.29**, $1,627.81 more than the
baseline. The scenario is a calculation, not a prediction, and nothing is saved: reload the page and the baseline is
exactly as before (`baseline_unchanged_by_scenario: true`). (`screenshots/08…`)

### Step 5 — Score the risk (Material Cost Intelligence → Calculate risk scores)

Expected with the default weights (version 1): no material reaches **High** (the High band starts at 50). The script prints these
scores as `risk_default_weights`.

| Material | Score | Level |
|:---|---:|:---|
| SOL-ALU-FRAME | 47.3 | Moderate |
| SOL-BACKSHEET | 41.9 | Moderate |
| SOL-CELL-M10 | 48.9 | Moderate |
| SOL-EVA-FILM | 35.2 | Moderate |
| SOL-GLASS-32 | 36.4 | Moderate |
| SOL-JBOX-IP68 | 24.3 | Low |

### Step 6 — Make the warning more sensitive (a configuration change)

To let the case flow be shown on this data, an administrator saves a new risk weight set with the **High band lowered
from 50 to 40**. This is a deliberate demonstration setting: it is a new version (never an edit), the old version stays
queryable, and all later scores and validations say which version they used. **This version has no screen for it**; the
script does it through the API (Path A does it automatically; for Path B run
`uv run python -m app.scripts.case_study --only risk` once, which also recalculates the scores). Then **Calculate risk
scores** again.

Expected with weights version 2:

| Material | Score | Level |
|:---|---:|:---|
| SOL-ALU-FRAME | 47.3 | High |
| SOL-BACKSHEET | 41.9 | High |
| SOL-CELL-M10 | 48.9 | High |
| SOL-EVA-FILM | 35.2 | Moderate |
| SOL-GLASS-32 | 36.4 | Moderate |
| SOL-JBOX-IP68 | 24.3 | Low |

The score of **SOL-CELL-M10** is **48.9**, explained on screen factor by factor. The three largest contributions:
supplier concentration (15.0), standard cost deviation (10.0), inventory coverage (8.9). (`screenshots/04…`, `11…`)

### Step 7 — Open a case, investigate, close it (the existing v1.4 flow)

Open **SOL-CELL-M10** and press **Open a case**. Expected: a case of type *Material cost risk*, priority High, for
SOL-CELL-M10, whose "Why this case was opened" panel repeats the stored score (48.9) and its
factors, the forecast horizon (90 days) and the exposure when opened. Opening the case again does not create a second
one. (`screenshots/12…`, `13a…`)

Then work it like any other case with two people: the **Risk reviewer** assigns it and starts the investigation
(Assigned → Under Investigation); the **System Administrator** takes the Corrective Action step (root cause); the
reviewer submits it (Pending Verification, corrective action). Sample entries: root cause *"The cell supplier's price
list was not renegotiated at the last renewal."*; corrective action *"A fixed-price clause was agreed for the next two
quarters."*

Two refusals to try, each from a different rule: the **reviewer cannot close the case** because only a verifier or an
administrator may (expected: HTTP 403, `PERMISSION_DENIED`), and
the **administrator cannot close it either**, although the role may, because they took part in the investigation
(expected: HTTP 403, `SEPARATION_OF_DUTIES_VIOLATION`,
the separation-of-duties rule). Closing also needs all eight closure fields. Sign in as the **Compliance verifier**, who
took no part, and close it with closure type *Process Error / Remedied*, evidence, follow-up and recurrence monitoring. Expected history: New → Assigned → Under Investigation → Corrective Action → Pending Verification → Closed. The case's Historical
Replay recalculates the score from what was known when the case was opened and reproduces it
(`replay_reproduces_stored_score: true`). (`screenshots/13b…`, `13c…`)

### Step 8 — How good would this have been? (Validation)

**Manufacturing → Validation → Run validation** with the defaults (30 and 90 days, a rise of 5% counts as a cost
risk, the warning level is the High band of the active weights, one month between dates). It goes back to 10
past dates (31 Jan to 31 Oct 2025), uses only what was known then, saves every forecast before looking at what happened,
and then compares. (Method version 1.2.) (`screenshots/14…`, `15…`)

Expected:

| | 30-day outlook | 90-day outlook |
|:---|---:|---:|
| Cases (6 materials × 10 dates) | 60 | 60 |
| Judged (the rest lack history or the later month is not in the data) | 60 | 36 |
| Typical error (MAPE) | 3.02% | 5.55% |
| Forecast closer than "the price stays the same" | 18% | 25% |
| Price rose ≥ 5% (risk events) | 8 of 60 | 12 of 36 |
| Warning raised and event happened / false alarm | 4 / 12 | 6 / 7 |
| No warning and event happened (missed) / no event | 4 / 40 | 6 / 17 |

## What the case study shows — and what it does not

- **What worked:** the pipeline ran from raw files to a closed case with every number traceable: the file import
  counted every row; each forecast says which model made it and why; the risk score explains itself; a scenario left the
  baseline untouched; the case followed the existing rules (a reviewer cannot close; neither can an administrator who took part in the
  investigation, each refused with its own error); the validation kept the later data out
  until after the forecasts were saved.
- **What the validation says about accuracy, plainly:** the forecasts were about as good as, not better than, assuming
  the price stays the same (closer in 18% of 30-day cases and further in more). The warning at the
  lowered level (40) caught 4 of 8 rises at 30 days and 6 of 12 at 90 days, with
  12 and 7 false alarms. These are indicative only: six materials, overlapping dates, synthetic prices, and the
  warning level was lowered on the same data for this demonstration. See `VALIDATION_RESULTS.md` and
  `TRANSFERABILITY_TEST.md` for the full runs and limitations.
- **What this does not show:** performance on real purchasing data, any saving or avoided cost, or that the
  warning is a reliable early signal.

## Reproducing and checking

| What | Command |
|:---|:---|
| Whole case study against a running backend on an empty database | `uv run python -m app.scripts.case_study --check` |
| Part of it | `… --only import_files,detect,forecast` (names: import_files, detect, forecast, exposure, risk, case, validate) |
| Regenerate the expected figures after a deliberate change | `… --write-expected` |
| The same check inside the test suite (own empty test database) | `uv run pytest tests/modules/v1/test_case_study_reproducible.py -v` |

What can differ between runs: identifiers (case numbers, run ids), timestamps and dates shown as "saved at". The
figures in this document do not.

## Independent check

See `docs/evidence/ticket-13/INDEPENDENT_CHECK.md` for who followed this document without the author's help, and how.
