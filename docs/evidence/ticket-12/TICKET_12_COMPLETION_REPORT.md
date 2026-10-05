## Ticket 12 — Transferability — COMPLETE (QA findings addressed; committed)

Branch `v2.0-manufacturing-extension`. Raw evidence is alongside this report. Not committed yet.

### Acceptance criteria
- **Environment B generated with genuinely different raw column names and source structure:** PASS. Industrial products (precision components and fasteners, D2) as one Excel workbook with eight sheets, its own column names, day-first dates, thousands separators, euro and dollar prices, several purchase lines a month, missing months, 36 months, different identifiers and categories (`backend/app/scripts/environment_b.py`, files in `docs/samples/environment_b/`). A test shows that **no preset (Generic, SAP-style, Dynamics-style) matches any raw column of any sheet** (so every mapping is explicit configuration), and that identifiers, categories, cadence, currencies and formats differ from Environment A.
- **Same canonical pipeline run against both with zero forked code paths:** PASS. Both are imported through the ordinary mapping import, then detection, forecasting, exposure, risk scoring and validation run through the same API. `git diff f924989 -- backend/app` shows no change to any existing application file. The required test records the functions that ran: the same pipeline files and stage entry points for both; 185 vs 184 functions, the differences being state/data-driven helpers (listed). Two source-reading tests find no environment name, part, vendor, category or raw column in any pipeline file and no special-casing of a dataset, material, supplier, category, currency or unit (comparison with a fixed value or list, `startswith`, fixed table or `match` keyed by one). After QA the scanners themselves are tested on code that special-cases each of those ways (flagged) and on ordinary code (not flagged). They are a tripwire, not a proof: the function trace cannot see a branch inside a shared function, and routes/models are not scanned.
- **`TRANSFERABILITY_TEST.md`:** PASS. `docs/TRANSFERABILITY_TEST.md`: configuration differences (column mapping, dataset name, supplier directory) against unchanged core, side-by-side results, limitations.

### Verification commands (raw output)
```
pytest tests/modules/v1/test_transferability.py -v          -> 28 passed, 1 skipped  transferability_tests.txt
  (required test alone)                                      -> 1 passed              required_test_raw_output.txt
cd backend && uv run pytest tests/ -q                        -> 379 passed, 1 skipped  backend_regression.txt
pytest -m pure -q (no database)                              -> 99 passed             pure_lane_run.txt
ruff check / format --check                                  -> clean                 ruff.txt
```
(The skipped test only writes the side-by-side raw responses when `TRANSFER_EVIDENCE_DIR` is set; it was run with it set: `live_runs/`.)
No schema, route or UI change in this ticket, so no migration or frontend build was needed.

### Validation results for both environments, side by side (same method 1.2 and settings; fresh database)
Run VAL-62C841802F (A) and VAL-DFA07BFDC6 (B); full table in `docs/TRANSFERABILITY_TEST.md`.

| | 30-day A | 30-day B | 90-day A | 90-day B |
|:---|---:|---:|---:|---:|
| Judged cases | 60 | 212 | 36 | 174 |
| Typical error (MAPE) | 3.0% | 1.7% | 5.6% | 3.4% |
| Closer / equal / further than "stays the same" | 18/53/28% | 19/50/31% | 25/42/33% | 25/42/33% |
| Risk events | 8 of 60 | 4 of 212 | 12 of 36 | 21 of 174 |
| Warning: correct / false alarms / missed | 1 / 6 / 7 | 0 / 4 / 4 | 1 / 5 / 11 | 0 / 4 / 21 |

Plainly: **the pipeline transferred mechanically (no code change, no rejected import row) and reports honestly on both. The accuracy conclusions do not improve: the forecasts again did not beat "the price stays the same", and the risk warning caught none of B's 25 events (1 of 8 and 1 of 12 in A).** Transfer here means the method runs and reports the same way on a different dataset, not that its forecasts or warnings are accurate on it.

### Problems the work found
- Generating B exposed two kinds of mistake in my own generator, none in the pipeline: a cost revision that ended before it began for a part first bought in 2025 (the import rejected that row and the test caught it), and several raw column names that accidentally matched a known preset (renamed so that nothing matches).
- The function-level comparison cannot demand identical sets (data-dependent helpers differ), so it asserts identical files and entry points and lists the allowed differences by name.

### Anything interpreted or decided that wasn't explicitly specified
1. "Zero forked code paths" is shown by (a) no change to existing code, (b) the same files/entry points running for both, (c) source scans for environment-specific literals and branches. It cannot prove the absence of every possible environment-dependent behaviour; data-driven behaviour (withholding a thin history) is expected and not counted as forking.
2. Environment A is the existing solar sample set (Ticket 5), imported with the preview's own suggestions; the SAP-style and Dynamics-style sample files were not re-used here. Environment B is imported with a custom mapping; the optional "one SAP-style and one Dynamics-style across the two environments" was not produced for B.
3. The supplier directory (a v1.4 master) is loaded outside the mapping engine for both environments.
4. The test-run validation uses cutoffs three months apart to stay fast; the evidence run uses every month.
5. The default risk weights (version 1, High band 50) were used for both, not the dev database's tuned version 2.

### Not done / open
- Both environments are synthetic; B was generated by us. A real second company's data would test the mapping harder.
- The Validation page has no dataset choice (API only); no UI change was made.
- B has few events (4 and 21), so its precision and recall say little.
- Dev database unchanged by this ticket (all runs used the isolated test database). v1.4 "before" screenshots and duplicate demo materials remain open from earlier tickets.

### QA findings and what was done (independent QA: no blocker)
- Major, scans only caught simple forms: scanners rewritten (currency, unit, description, name added; list/tuple membership, `startswith`/`endswith`, fixed-table lookups and `match` flagged; case-insensitive literal match; exact raw-column match) and tested on 11 special-casing forms plus benign code. The doc no longer says "both fail when a line is added" without limits; it says tripwire, not proof.
- Major (completeness), A is close to the canonical schema: stated prominently under "What this does not show" in `TRANSFERABILITY_TEST.md`; the optional SAP/Dynamics demonstration for B remains not done.
- Minor: scale/format assumptions (no unit conversion, 0-1 on-time rate, date formats, no currency conversion) listed in the doc; weak assertions in the "B is different" test replaced and the entry-point list made fixed (all six now required); the "steadier price series" claim removed; event counts described as overlapping cases; `BytesIO` import moved to the top.
