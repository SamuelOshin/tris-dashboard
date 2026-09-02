# TRIS v1.3: Synthetic Test Data & Test Matrix Reference
**Source File**: 	est data.xlsx
*Synthetic datasets, demonstration rules, expected test cases, and developer acceptance matrix.*

---

## Worksheet: README

| TRIS v1.3 Synthetic Test Data Package |  |
| :--- | :--- |
| Purpose | Synthetic data for development and testing of the TRIS v1.3 web prototype. No real employer, customer, supplier, banking, or personal data is included. |
| Primary scenario | A supplier payment is materially above its historical baseline, the supplier's bank details changed recently, a required approval is missing, and an unusual after-hours access event occurred. |
| Expected workflow | Ingest -> Validate -> Baseline -> Detect -> Connect -> Explain -> Prioritize -> Assign Owner -> Investigate -> Root Cause -> Corrective Action -> Verify Closure -> Monitor Recurrence. |
| Important | All thresholds and priorities in this workbook are demonstration rules only. They must be configurable and should not be represented as validated fraud probabilities or production-ready controls. |
| Primary expected case | TEST-CASE-001 |
| Recommended environment | Use only in a development/staging environment until the workflow is tested and approved. |
| Web support Grant fee | Let the web name be in your Name Abigeal so we can no who is responsible for each we have a lot of student doing this program |

## Worksheet: Suppliers

| supplier_id | supplier_name | category | risk_tier | bank_change_date | bank_change_reason | active | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SUP-001 | Northstar Components LLC | Electrical Components | Medium | 2026-08-26 | Requested by supplier; pending enhanced verification | True | Primary synthetic test supplier |
| SUP-002 | Blue River Packaging Inc. | Packaging | Low |  |  | True | Normal control supplier |
| SUP-003 | Apex Glass Materials LLC | Glass | Medium | 2026-05-10 | Routine verified update | True | Normal activity |
| SUP-004 | Summit Cell Technologies LLC | Solar Cells | High |  |  | True | Higher inherent supply risk |
| SUP-005 | Prairie Logistics Services LLC | Logistics | Low |  |  | True | Normal activity |
| SUP-006 | Ironwood Fasteners LLC | Fasteners | Low |  |  | True | Normal activity |
| SUP-007 | ClearPeak Chemicals LLC | Process Materials | Medium |  |  | True | Normal activity |
| SUP-008 | Redwood Automation LLC | Automation | Medium |  |  | True | Normal activity |

## Worksheet: Transactions

| transaction_id | supplier_id | invoice_no | invoice_date | posting_date | amount_usd | currency | approval_required | approval_status | payment_status | description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TX-1001 | SUP-001 | NC-260101 | 2026-01-18 | 2026-01-20 | 28500 | USD | True | Approved | Paid | Historical baseline invoice |
| TX-1002 | SUP-001 | NC-260215 | 2026-02-15 | 2026-02-17 | 31200 | USD | True | Approved | Paid | Historical baseline invoice |
| TX-1003 | SUP-001 | NC-260320 | 2026-03-20 | 2026-03-21 | 29800 | USD | True | Approved | Paid | Historical baseline invoice |
| TX-1004 | SUP-001 | NC-260418 | 2026-04-18 | 2026-04-20 | 32100 | USD | True | Approved | Paid | Historical baseline invoice |
| TX-1005 | SUP-001 | NC-260519 | 2026-05-19 | 2026-05-20 | 30400 | USD | True | Approved | Paid | Historical baseline invoice |
| TX-1006 | SUP-001 | NC-260621 | 2026-06-21 | 2026-06-22 | 29500 | USD | True | Approved | Paid | Historical baseline invoice |
| TX-1007 | SUP-001 | NC-260719 | 2026-07-19 | 2026-07-20 | 31800 | USD | True | Approved | Paid | Historical baseline invoice |
| TX-1999 | SUP-001 | NC-260828 | 2026-08-28 | 2026-08-28 | 104000 | USD | True | Missing | Pending | PRIMARY TEST: amount anomaly + recent bank change + missing approval |
| TX-2001 | SUP-002 | BR-260701 | 2026-07-05 | 2026-07-06 | 8200 | USD | True | Approved | Paid | Normal packaging invoice |
| TX-2002 | SUP-002 | BR-260801 | 2026-08-05 | 2026-08-06 | 8450 | USD | True | Approved | Paid | Normal packaging invoice |
| TX-3001 | SUP-003 | AG-260610 | 2026-06-10 | 2026-06-11 | 45500 | USD | True | Approved | Paid | Normal glass invoice |
| TX-3002 | SUP-003 | AG-260710 | 2026-07-10 | 2026-07-11 | 47200 | USD | True | Approved | Paid | Normal glass invoice |
| TX-3003 | SUP-003 | AG-260810 | 2026-08-10 | 2026-08-11 | 46100 | USD | True | Approved | Paid | Normal glass invoice |
| TX-4001 | SUP-004 | SC-260821 | 2026-08-21 | 2026-08-22 | 78000 | USD | True | Approved | Paid | Original invoice |
| TX-4002 | SUP-004 | SC-260821 | 2026-08-21 | 2026-08-29 | 78000 | USD | True | Approved | Pending | DUPLICATE TEST: same supplier and invoice number |
| TX-5001 | SUP-005 | PL-260801 | 2026-08-02 | 2026-08-03 | 12400 | USD | True | Approved | Paid | Normal logistics invoice |
| TX-6001 | SUP-006 | IF-260812 | 2026-08-12 | 2026-08-13 | 6700 | USD | False | Not Required | Paid | Normal low-value transaction |
| TX-7001 | SUP-007 | CP-260815 | 2026-08-15 | 2026-08-16 | 21300 | USD | True | Approved | Paid | Normal process material invoice |
| TX-8001 | SUP-008 | RA-260820 | 2026-08-20 | 2026-08-21 | 39200 | USD | True | Approved | Paid | Normal automation invoice |

## Worksheet: Access_Events

| event_id | user_id | event_time | system | action | resource | supplier_id | result | location_context | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AE-001 | USR-101 | 2026-08-25 10:15 | ERP | View | Supplier Master | SUP-001 | Success | Corporate network | Normal business-hours activity |
| AE-002 | USR-204 | 2026-08-26 14:30 | ERP | Modify | Supplier Bank Details | SUP-001 | Success | Corporate network | Bank details changed |
| AE-003 | USR-204 | 2026-08-27 22:47 | ERP | View | Supplier Master | SUP-001 | Success | Remote access | PRIMARY TEST: after-hours access related to primary supplier |
| AE-004 | USR-301 | 2026-08-28 09:10 | ERP | View | Payment Journal | SUP-001 | Success | Corporate network | Normal reviewer activity |
| AE-005 | USR-110 | 2026-08-21 11:05 | ERP | View | Supplier Master | SUP-004 | Success | Corporate network | Normal activity |
| AE-006 | USR-411 | 2026-08-29 20:55 | ERP | View | Invoice Register | SUP-004 | Success | Remote access | Late activity, but not primary test |
| AE-007 | USR-120 | 2026-08-15 08:45 | ERP | View | Supplier Master | SUP-003 | Success | Corporate network | Normal activity |
| AE-008 | USR-121 | 2026-08-16 15:12 | ERP | View | Purchase Order | SUP-007 | Success | Corporate network | Normal activity |

## Worksheet: Approvals

| approval_id | transaction_id | required_level | approver_role | approval_status | approval_date | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AP-1001 | TX-1001 | Level 1 | Finance Manager | Approved | 2026-01-19 | Historical approval |
| AP-1002 | TX-1002 | Level 1 | Finance Manager | Approved | 2026-02-16 | Historical approval |
| AP-1003 | TX-1003 | Level 1 | Finance Manager | Approved | 2026-03-20 | Historical approval |
| AP-1004 | TX-1004 | Level 1 | Finance Manager | Approved | 2026-04-19 | Historical approval |
| AP-1005 | TX-1005 | Level 1 | Finance Manager | Approved | 2026-05-19 | Historical approval |
| AP-1006 | TX-1006 | Level 1 | Finance Manager | Approved | 2026-06-21 | Historical approval |
| AP-1007 | TX-1007 | Level 1 | Finance Manager | Approved | 2026-07-19 | Historical approval |
| AP-1999 | TX-1999 | Level 2 | Controller | Missing |  | PRIMARY TEST: required approval absent |
| AP-4001 | TX-4001 | Level 2 | Controller | Approved | 2026-08-21 | Approved |
| AP-4002 | TX-4002 | Level 2 | Controller | Approved | 2026-08-28 | Duplicate invoice still has approval |

## Worksheet: Demo_Rules

| rule_id | rule_name | demo_condition | example_reason_text | default_weight | validation_status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| R-001 | Amount deviation | Flag when current amount > 2.0x supplier historical average (configurable demo threshold) | Transaction is materially above the supplier historical baseline. | 35 | Demo only - not validated |
| R-002 | Recent bank change | Flag when supplier bank details changed within previous 7 days | Supplier bank details changed recently. | 25 | Demo only - not validated |
| R-003 | Missing required approval | Flag when approval_required = TRUE and approval_status != Approved | Required approval is missing. | 25 | Demo only - not validated |
| R-004 | Unusual access time | Flag relevant supplier/account access outside 06:00-20:00 local time (configurable) | Related access activity occurred outside the configured normal window. | 15 | Demo only - not validated |
| R-005 | Duplicate invoice | Flag duplicate supplier_id + invoice_no combination | Possible duplicate invoice detected. | 30 | Demo only - not validated |
| R-006 | Recurrence | Flag similar issue involving same supplier/root-cause category within 90 days | A similar issue may have occurred previously. | 20 | Demo only - not validated |

## Worksheet: Expected_Cases

| case_id | primary_record | supplier_id | expected_flags | expected_priority | expected_explanation | expected_owner_status | expected_next_action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TEST-CASE-001 | TX-1999 | SUP-001 | R-001; R-002; R-003; R-004 | High | Amount is materially above historical baseline; bank details changed recently; required approval is missing; related after-hours access exists. | New / Unassigned | Assign owner, investigate supplier change and transaction, document root cause, corrective action, and verified closure. |
| TEST-CASE-002 | TX-4002 | SUP-004 | R-005 | Medium | Supplier and invoice number duplicate a prior transaction. | New / Unassigned | Review for duplicate posting/payment before release. |

## Worksheet: Case_Workflow_Sample

| case_id | status | owner | department | investigation_summary | root_cause | corrective_action | closure_type | closure_evidence | verified_by | closure_date | recurrence_monitoring |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TEST-CASE-001 | New |  |  | Generated from linked synthetic risk signals |  |  |  |  |  |  |  |
| TEST-CASE-001 | Assigned | A. Reviewer | Finance | Review supplier master change, approval trail, and payment exception |  |  |  |  |  |  |  |
| TEST-CASE-001 | Under Investigation | A. Reviewer | Finance | Confirmed bank update occurred before anomalous transaction; approval control not completed | Supplier bank-change verification workflow not completed | Require independent verification of supplier banking change and second approval |  |  |  |  |  |
| TEST-CASE-001 | Pending Verification | A. Reviewer | Finance | Corrective action recorded and supporting evidence attached | Supplier bank-change verification workflow not completed | Independent verification completed and approval control updated | Financial/Control | Synthetic verification reference DOC-TEST-001 | B. Verifier |  | Monitor same supplier and cause category for 90 days |
| TEST-CASE-001 | Closed | A. Reviewer | Finance | Closure verified | Supplier bank-change verification workflow not completed | Independent verification completed and approval control updated | Financial/Control | Synthetic verification reference DOC-TEST-001 | B. Verifier | 2026-08-31 | Monitor same supplier and cause category for 90 days |

## Worksheet: Developer_Tests

| test_id | test_name | input_or_action | expected_result | evidence_to_capture | status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T01 | Data import | Load Suppliers, Transactions, Access_Events, and Approvals sheets | Rows ingest successfully; schema/type errors are reported clearly | Screenshot + import log | Not Run |
| T02 | Baseline calculation | Calculate SUP-001 historical amount baseline excluding TX-1999 | Baseline reflects historical transactions only and is visible/explainable | Baseline output + formula/logic reference | Not Run |
| T03 | Primary exception detection | Process TX-1999 | R-001, R-002, R-003, and R-004 trigger and are linked to one case | Case screenshot + rule execution log | Not Run |
| T04 | Explainability | Open TEST-CASE-001 | User sees plain-language reasons for each triggered rule; no unsupported fraud probability is shown | Case-detail screenshot | Not Run |
| T05 | Ownership | Assign case to an owner and department | Assignment, timestamp, status, and history persist | Case history screenshot | Not Run |
| T06 | Verified closure | Attempt to close case without root cause/evidence/verifier | System blocks closure until required closure fields are complete | Validation screenshot | Not Run |
| T07 | Recurrence | Create a similar later exception for SUP-001 | System surfaces relevant prior case and prior root cause/corrective action | Recurrence screenshot | Not Run |
| T08 | Duplicate invoice | Process TX-4002 | R-005 triggers and references TX-4001 | Alert screenshot | Not Run |
| T09 | Normal-case control | Process a normal SUP-002 transaction | No material risk case is created under demo thresholds | Result screenshot | Not Run |
| T10 | Audit trail | Edit owner/status/notes on a case | All changes are timestamped and preserved in case history | Audit-history screenshot | Not Run |

## Worksheet: Data_Dictionary

| dataset | field | type | required | description |
| :--- | :--- | :--- | :--- | :--- |
| Suppliers | supplier_id | Text | Yes | Unique synthetic supplier identifier |
| Suppliers | bank_change_date | Date | No | Most recent supplier banking change date used by demo recent-change rule |
| Transactions | transaction_id | Text | Yes | Unique transaction identifier |
| Transactions | supplier_id | Text | Yes | Links transaction to supplier |
| Transactions | invoice_no | Text | Yes | Supplier invoice identifier; used for duplicate checks |
| Transactions | amount_usd | Decimal | Yes | Transaction amount used in baseline/deviation testing |
| Transactions | approval_required | Boolean | Yes | Whether approval is required |
| Transactions | approval_status | Text | Yes | Approved, Missing, Pending, or Not Required |
| Access_Events | event_time | DateTime | Yes | Event timestamp used for unusual-time rule |
| Access_Events | supplier_id | Text | No | Links access event to supplier when relevant |
| Approvals | transaction_id | Text | Yes | Links approval record to transaction |
| Expected_Cases | expected_flags | Text | Yes | Expected rule IDs for developer validation |
| Case_Workflow_Sample | root_cause | Text | Required for closure | Documented root cause category/description |
| Case_Workflow_Sample | closure_evidence | Text | Required for closure | Evidence/reference supporting closure verification |
| Case_Workflow_Sample | verified_by | Text | Required for closure | Person who verifies closure |
