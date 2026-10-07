# Screenshot and demo evidence checklist (work plan Section 15)

Captured on 5 Oct 2026 from the running application (1440 px wide, dark theme) on an empty database loaded only
with `docs/CASE_STUDY_01.md` (Environment A) and Environment B. All data is synthetic. Files are in `screenshots/`.
Signed in as the demo administrator unless stated.

| # | Checklist item | Status | File | Notes |
|:--|:---|:---|:---|:---|
| 1 | Login page showing TRIS branding and Evaluation/Synthetic Data label | Captured | `01_login_page.png` | Shows "Evaluation environment · Synthetic test data only". |
| 2 | Main dashboard after login | Captured | `02_dashboard_after_login.png` | The v1.4 dashboard (unchanged). |
| 3 | Material Cost Intelligence overview | Captured | `03_material_cost_overview.png` | Six Environment A materials with signals and risk scores. |
| 4 | Material Risk Detail with explainable drivers | Captured | `04_material_risk_detail_drivers.png` | SOL-CELL-M10, score 48.9 High, factor by factor. |
| 5 | ERP/BOM mapping screen | Captured | `05a_…nothing_recognised.png`, `05b_…mapped.png` | Environment B workbook: every field "Not matched" until mapped by hand, then mapped. |
| 6 | Successful ingestion summary | Captured | `06_ingestion_summary_environment_b.png` | 12 rows read, 12 imported, 0 rejected. |
| 7 | Forecasting screen with historical + predicted series | Captured | `07_forecasting_history_and_prediction.png` | History, forecast, range, model and why it was chosen. |
| 8 | Scenario modelling screen | Captured | `08_scenario_modelling.png` | Price +10%; labelled as a scenario, nothing saved. |
| 9 | BOM/product impact view | Captured | `09_bom_product_impact.png` | Exposure by product (PANEL-60C). |
| 10 | Financial exposure view | Captured | `10_financial_exposure_view.png` | Spend at latest and forecast prices, projected exposure per material. |
| 11 | Risk score explanation | Captured | `11_risk_score_explanation_factors.png` | Lower factors of the same panel as item 4. |
| 12 | Create Risk Case from material-risk signal | Captured | `12_open_case_from_material_signal.png` | After pressing Open a case for SOL-ALU-FRAME: "Case … is open (New)". |
| 13 | Existing investigation / corrective action / closure flow connected to the new signal | Captured | `13a…`, `13b…`, `13c…` | New case; the closed SOL-CELL-M10 case with why-opened panel; its history. |
| 14 | Validation configuration screen | Captured | `14_validation_configuration.png` | Run form (outlooks, event size, warning score, months between dates). |
| 15 | Validation result: predicted vs actual + metrics | Captured | `15_validation_results_predicted_vs_actual.png` | Metrics per outlook; false alarms and missed events list forecast move against actual move. |
| 16 | Transferability example for Environment B | Captured | `16_transferability_environment_b_overview.png` | The same page and pipeline with the dataset filter set to Environment B (euro and dollar rows). |
| 17 | System Administration / model configuration | Captured | `17a_administration_models_and_settings.png`, `17b_administration_risk_weights.png`, `17c_administration_datasets.png`, `17d_administration_saved_mappings.png` | The new admin-only Administration page: forecast models with on/off (one switched off here, with who and when), risk weight editor with version history, dataset registry with its synthetic label, saved mappings. (`17_settings_and_governance_what_exists.png` is the older v1.4 page and is not the requested screen.) |
| 18 | Audit log showing versioned actions | Captured | `18_audit_log.png` | The Administration page's audit log: weight version 2 saved with its reason, risk scores calculated with weights version 1 and 2, model switched off, dataset labelled, mapping saved, case opened, validation run. The older `18_compliance_audit_trail_static_sample_data.png` is v1.x static sample data and is **not** evidence. |

Also saved: `browser_console_login_page.log` and `browser_console_material_cost_page.log` (browser console on the
sign-in page and after sign-in). No credential or token appears in either; the words "password" only occur in a
browser hint about the field's autocomplete attribute. The sign-in page log has two `401` responses from the
"who am I" check made before anyone has signed in, which is expected; the page after sign-in has none.

**Result: 18 of 18 captured.** Items 17 and 18 had no screen when the first set was taken (work plan Section 10 was not part
of the 14 tickets); the Administration page was built and captured afterwards.

Caveat on `13c_closed_case_history_trail.png`: it is the unchanged v1.4 case timeline. It lists "Case closed &
verified" (01:00) above "created" (08:42), most likely because the closure date is stored as a date without a time
(not investigated), and the card attributes the verification to "TRIS" although the verifier persona closed the case.
These look like v1.4 display quirks, not part of v2.0; do not present this image as proof of timing or of who verified.

The v1.4 "before" screenshots deferred in `docs/BASELINE_README.md` are a separate item and are still not captured.
