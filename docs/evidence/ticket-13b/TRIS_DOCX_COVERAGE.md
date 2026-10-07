# Work plan (`TRIS.docx`) coverage after Ticket 13b

Checked by reading the code and the docs on 2026-10-07. "Built" means present and working in the application; "Ticket 14" means
it is a release check, not a build item.

| Work plan section | Status | Notes |
|:---|:---|:---|
| 2. What must stay | Built (unchanged) | Existing modules, auth, cases, ingestion, governance kept; the full existing suite passes. |
| 3. What must be added | Built | Manufacturing section, Material Cost Intelligence, mapping, forecasting, exposure, scenarios, risk score, validation, transferability, documentation. |
| 4.1 Login page | Built | Brand, tagline, evaluation label, show/hide password, loading state, safe error, Forgot password. **13b:** repeated failures now pause sign-in (5 in 15 minutes, same answer whether or not the account exists). |
| 4.2 Auth, roles, audit | Built | Four-role model plus read-only reviewer (decision D7). Backend protects every route. **13b:** sign-out is now recorded; sign-in, failure, user creation, role and status changes were already recorded. |
| 4.3 Layout | Built | **13b:** environment label in the top bar. The dataset name and data date are on the Material Cost summary; the other manufacturing pages use all data (known, listed in the handover). |
| 4.4 Global states | Built | Loading, empty, error, success, no-data, permission-denied on every manufacturing screen. |
| 4.5 Responsive and accessibility | Built, Ticket 14 re-checks | Tables scroll sideways instead of clipping; risk levels are text plus colour. |
| 5. Main dashboard | **Built in 13b** | Four cards, trend chart, top-exposure table, links to the material and the case. |
| 6.1 Overview | **Built in 13b** | Forecast, % change, exposure and risk-level filter added; export of the filtered table added. |
| 6.2 Material detail | **Built in 13b** | Forecast and exposure section with model, version, forecast date and dataset version; open or link a case. |
| 6.3 ERP/BOM mapping | Built | Generic, SAP-style and Dynamics-style layouts, saved profiles, error log. |
| 6.4 Forecasting and scenarios | Built | Forecast with its range where the model gives one; scenario controls; scenarios labelled and never stored. |
| 6.5 Validation | Built | Cutoff protocol, metrics, stored runs, failures kept. |
| 7. Data schema | Built | `DATA_DICTIONARY.md`. |
| 8. Analytics engine | Built | Detection, interpretable forecast models, exposure formulas, versioned risk score. |
| 9. End-to-end workflow | Built | `CASE_STUDY_01.md` reproduces it. |
| 10. System administration | Built (13) | Administration page: model on/off, risk weights, dataset registry, saved mappings, audit log. User management stays on Settings and Governance. |
| 11. Security, audit, integrity | Built, Ticket 14 re-checks | Credentials and HTTPS are release checks. |
| 12. Validation protocol | Built | `VALIDATION_PROTOCOL.md`. |
| 13. Transferability | Built | Environment B through the same pipeline. |
| 14. Documentation | Built | All documents in `docs/`. |
| 15. Screenshots | Built | 18 of 18 in `docs/evidence/ticket-13`. |
| 16. Test checklist, 17. Acceptance criteria | Ticket 14 | Run in full and recorded there. |
| 20. Handover package | Partly | Before screenshots of v1.4 to be supplied by the owner; screen recording optional; demo accounts to be shared securely outside the repository. |

Deliberately not done: no live ERP connector (claimed nowhere), no real-data pilot, no unit or currency conversion.
