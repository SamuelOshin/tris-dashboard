# TRIS v2.0 — ERP/BOM Mapping Guide

How to bring a CSV or Excel export from an ERP or planning system into the canonical manufacturing
schema (see `DATA_DICTIONARY.md`). Screen: **Manufacturing → ERP/BOM Data Mapping**.

> **What this is, and is not.** The SAP-style and Dynamics 365-style options are *import
> demonstrations*. TRIS reads a file you upload and matches its columns to the canonical fields. It
> does not connect to SAP, Dynamics or any other ERP system, and nothing in the product says otherwise.
> The preset column names are the technical field names those systems commonly use; real exports vary
> by company, so every match is shown to the user and can be changed.

All sample files are **synthetic** (a solar-panel manufacturer, 2024–2025) and live in
`docs/samples/erp_mapping/`. They are not company data.

A second, differently shaped sample set (an industrial-parts workbook with its own column names, used for the
transferability test) is in `docs/samples/environment_b/`; see `TRANSFERABILITY_TEST.md`.

## The flow

1. **Choose data and layout.** Pick what the file contains (one of 11 canonical tables), the layout
   (Generic, SAP-style, Dynamics 365-style, or a saved mapping profile) and the file (`.csv` or `.xlsx`).
2. **Preview.** TRIS shows the columns, the first rows and the row count, and suggests a match for every
   field. If the file looks like a different layout than the one chosen, the better-matching layout is
   selected and the mapping is re-suggested.
3. **Match columns.** One row per canonical field, marked **Required** or **Optional**. Each field takes
   a source column, or a fixed value used when the file has no such column. Required fields without
   either block the import.
4. **Check file** (dry run). Every row is validated; nothing is saved. The result shows rows read, ready,
   rejected, duplicates and blanks, warnings, missing values, and the reason for every rejected row.
5. **Import.** Valid rows are saved and an import record is kept (who uploaded, when, which file, which
   mapping). Rejected rows stay out and are listed in the error log, which can be downloaded as CSV.
6. **Save the mapping** (administrators) so the next file with the same layout can start from it.

## Layouts

| Layout | Label in the UI | Typical columns it recognises |
|:---|:---|:---|
| Generic | Generic CSV / Excel | Canonical names plus common synonyms (`material`, `vendor`, `qty`, `uom`, `po_number`…) |
| SAP-style | SAP-style import demonstration | `MATNR`, `MAKTX`, `MATKL`, `MEINS`, `LIFNR`, `EBELN`, `BEDAT`, `MENGE`, `NETPR`, `WAERS`, `IDNRK`, `STPRS`, `VERPR`… |
| Dynamics-style | Dynamics 365-style import demonstration | `ItemNumber`, `ProductName`, `VendAccount`, `PurchId`, `OrderDate`, `PurchQty`, `PurchPrice`, `CurrencyCode`, `BOMQuantity`… |

Matching ignores case and punctuation. The full list is in
`backend/app/api/modules/v1/manufacturing/service/source_profiles.py`.

## What the validator accepts

| Kind | Accepted | Notes |
|:---|:---|:---|
| Text | Any; control characters removed | Longer than the field allows → shortened and reported as a warning. Read as text, so `000000000000100234` keeps its leading zeros. |
| Number | `1234.5`, `1,234.50` | Comma as thousands separator only. `1.250,00` (European style) is **rejected**, not guessed. Must be finite; ranges per field (for example quantity > 0, delivery rate 0–1). |
| Date | `2026-01-31`, `20260131`, `31.01.2026`, `01/31/2026`, Excel date-times | `MM/DD/YYYY` is read as month first. An all-zero date (`00000000`) means "no date". |
| Yes/No | `true/false`, `yes/no`, `y/n`, `1/0`, `X` | `X` is the ERP convention for a set flag. |
| Empty | `""`, `nan`, `null`, `n/a`, `-` | Counts as missing. |

Cross-field rules: period end not before period start; for some tables at least one of several values
must be present (for example one cost on a cost row). Foreign references must already exist: supplier
codes against the existing supplier list, material codes against the material master. **Import the
material master first.**

## Duplicates

A natural key per table (for example material + date for inventory) identifies a record that is already
stored or repeated in the same file. The choice is **Skip them** (counted as duplicates, not errors) or
**Reject them** (counted as rejected). Purchase lines without a reference are never treated as duplicates
unless every identifying value matches.

## Protection against a wrong mapping (circuit breaker)

This is the v1.4 ingestion rule, reused unchanged: with at least 10 rows, if **more than 20%** are
rejected the whole import stops and **nothing is saved** (the import is recorded as failed). The message
names the field that caused most rejections and the column it was matched to, for example *"Most rejected
rows failed on `quantity` (mapped from column `LIFNR`)"*. Exactly 20% is tolerated.

## Error log

Each entry has the file line number, the field, a plain-language problem, and the source values of that
row. Structurally broken rows (a different number of cells than the header) are reported the same way
instead of stopping the file. The screen shows the first 50; the CSV download holds up to 1,000.
Text that could be run as a spreadsheet formula is escaped in the download.

## Saved mapping profiles

A profile stores the target table, the field-to-column mapping, fixed values, the layout it started from,
who saved it and when. Loading a profile against a new file keeps matches whose column exists and tells
the user which saved columns were not found. Deleting a profile never changes past imports, which keep
their own copy of the mapping they used.

| Action | Who |
|:---|:---|
| Upload, preview, check, import, list/load profiles, download an error log | Administrator, Risk Reviewer |
| Save or delete a profile | Administrator |
| Anything in this tool | Not available to Read-Only Reviewer, Verifier, Process Owner |

These limits are enforced on the server, not only in the interface.

## Worked examples (synthetic files)

| Example | Files | What it shows |
|:---|:---|:---|
| Generic | `generic_materials.csv` → `generic_purchases.csv` | Synonym matching (`po_number` → purchase reference), ISO dates |
| SAP-style | `sap_style_materials.csv` → `sap_style_purchases.csv` | Semicolon delimiter detected, `MATNR` leading zeros kept, `YYYYMMDD` dates |
| Dynamics-style | `dynamics_style_materials.csv` → `dynamics_style_purchases.csv`, `dynamics_style_bom.csv` | PascalCase names, bill-of-materials lines |
| Production and a second product | `generic_bom_72c.csv`, `generic_production.csv` (targets: Bill of materials, Production volume) | Gives the product roll-up of financial exposure (Ticket 8) something to allocate to; load after the materials |
| Error log | `sap_style_purchases_with_errors.csv` | Impossible date, text quantity, unknown material, unknown supplier, ragged row |

Suppliers referenced by the samples (`SUP-001` … `SUP-007`) come from the seeded supplier list. The
samples contain 144 monthly purchase lines for six solar-component materials, so they can feed later
analytics steps.

## Limits

- `.csv` and `.xlsx` only (an older `.xls` must be saved as `.xlsx`); 25 MB; 100,000 data rows.
- No unit-of-measure or currency conversion. Values are stored as supplied.
- European decimal format and other locale-specific numbers are rejected, not converted.
- Layout presets are name lists, not certified extract formats.
- One worksheet per import; pick the sheet in the preview.
