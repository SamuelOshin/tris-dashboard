# TRIS v2.0 — Material Cost Risk Cases

How a high-risk material becomes a Risk Case and runs through the existing case lifecycle (decision D3). Code:
`backend/app/api/modules/v1/manufacturing/service/material_case_service.py`, routes
`routes/material_case_routes.py` (`/api/v1/manufacturing/material-cases`), tests `test_material_case_integration.py`.

## Opening or linking a case

A **stored** risk score (Ticket 9) that is **High or Critical** can open a case:

`POST /manufacturing/material-cases` with `{ "score_id": "...", "note": "..." }` (admin or reviewer).

- A score below High is refused (422); an unknown score is 404.
- The score must be the **newest saved score** for that material. An older High score cannot open (or be linked to) a case
  after a newer score has been saved, even if the newer one is lower (422, naming the newer score).
- Requests for one material take turns (a database lock held until the case is saved), so two simultaneous requests
  cannot open two cases: the second is told the case is already open (409).
- If a case for that material is already open (not Closed), a second one is **not** opened (409). Send
  `link_case_id` to **link** the newer score to the open case instead: the score is added to the case snapshot and
  an audit entry *Material Risk Score Linked* is written. A score can be linked once, only to a material-cost case of
  the same material, and not to a closed case.
- Once a case has been closed, a new High score can open a new case. The earlier one shows up under Recurrence.

The new `RiskCase` has `case_category = material_cost_risk` and the optional fields from D3:

| Field | Value |
|:---|:---|
| `material_id` | the scored material |
| `supplier_id` | the supplier with the largest spend on it in the year to the score date |
| `forecast_horizon` | days of the stored forecast the score used (if any) |
| `projected_exposure_amount` | the exposure for that horizon as of the score date (Ticket 8; if a forecast exists) |
| `priority` | High (Critical risk scores map to the existing top priority) |
| `trigger_signals` | the factors that drove the score, in the shape the case page already shows (`MAT-<FACTOR>`) |
| `evaluation_snapshot` | everything known when it was opened: score, level, weights version, every factor with its reason, the forecast and the exposure |

Opening writes the first audit entry, *Case Created from Material Risk Score*, by the signed-in user (never taken
from the request body).

## The lifecycle is unchanged

After creation the case uses the ordinary `/cases/...` endpoints. **No transition rule, state check, closure rule or
separation-of-duties check looks at the case category** (a test reads the case service source to keep it that way):

- the same transition matrix (New → Assigned → Under Investigation → Corrective Action → Pending Verification →
  Closed, Closed → Reopened), with the same preconditions (root cause before Corrective Action, corrective action
  before Pending Verification);
- the same eight mandatory closure fields, and only a verifier or administrator can close;
- the same separation of duties: anyone who investigated (assigned, investigated or remediated, by any of their
  identities, or named as verifier) cannot close the case;
- the same immutable history, notifications and reopening.

Two small, category-neutral changes were made in the case module so the new cases display and recur correctly: the case
response now includes `case_category`, `material_id`, `forecast_horizon` and `projected_exposure_amount`, and the case
list accepts `case_category` and `material_id` filters. The recurrence lookup (earlier cases for the same subject) now
matches on **supplier or material within the same kind of case**, so financial-exception cases and material-cost cases
never list each other, and a missing supplier or material never matches every other case that also has
none (before, two cases without a supplier would list each other).

## What is shown differently (data, not logic)

The case page picks components by category:

- **Overview**: the material, why it was opened (the score and the factor reasons), the money at stake, instead of the
  transaction and rule-signal view.
- **Historical Replay**: the material as scored on the case's score date: score, forecast, exposure and factors, a
  check that the score **reproduces** from its own saved record, and how the material scores now. For financial cases
  this tab keeps reconstructing the transaction as before. Only information available on the score date is used.
- **Recurrence**: earlier material-cost cases for the same material or supplier.
- **History, Investigation, Corrective Action and Closure** are the existing tabs.

In Material Cost Intelligence, the detail panel of a High or Critical material offers *Open a case*, or links to the
case already open and offers *Link this score* when the newer score is not on it yet.

## Limitations

- The Historical Replay of a material case replays the saved score, not a transaction: there is no remediation
  what-if for material cases yet.
- Opening a case is a decision of a person (admin or reviewer); no case is opened automatically.
- Recurrence is kept within the same kind of case; a supplier's financial-exception history is not shown on a
  material-cost case, and the other way round.
- Priority is High for both High and Critical scores because the case priority scale has no higher value.
