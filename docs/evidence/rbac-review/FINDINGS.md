# Role-based access: what is enforced and what the screens show

Checked on 2026-10-12 against the running v2.0.1 application, for the five demo roles.

## 1. The server enforces roles (`role_matrix.json`)
82 endpoints probed for each role (7 that would run a calculation were not probed). Writes were sent with a body that cannot succeed:
a 403 means the role is refused, anything else means the role was let through the permission check.

| Role | Reads allowed | Writes allowed |
|:--|--:|--:|
| Administrator | 53 | 22 |
| Risk reviewer | 48 | 14 |
| Read-only reviewer | 44 | 3 (own profile, own password, and the what-if scenario calculator, which stores nothing) |
| Compliance verifier | 27 | 7 |
| Process owner | 27 | 7 |

Examples of refusals: user management, rule changes, notifications and the whole Administration area are administrator-only; file import,
forecasts, scoring and validation runs, and opening material cases are administrator and reviewer; the Manufacturing section is closed to
the verifier and process owner; the read-only reviewer is refused on every write.

## 2. What is the same for every role
- **Reading the v1.x data.** Every signed-in role can read cases, suppliers, transactions, detection rules, access events, notifications,
  ingestion jobs and replays. That is the v1.4 design (`CASE_READ_ROLES` is every role), so the main dashboard's risk overview, audited
  invoices and alerts are the same for all of them. Only the heading line under "Welcome Back" and the Manufacturing summary differ.

## 3. The gap: the screens do not show the role's limits
- The dashboard quick actions ("Upload Data", "Investigate", "Access Logs") and the sidebar's Data Ingestion link appear for every role.
  (The Ingestion page itself does show a read-only notice for roles that cannot import.)
- **The case page shows the same editing buttons to every role** (Save Changes, Autofill Sample, Mark as Closed), including the read-only
  reviewer, and a reviewer sees "Mark as Closed" although only a verifier or administrator may close. The refusal appears only after a click.
  `components/cases` does not look at the role at all.
- Settings & Governance already does it right: non-administrators see the rule switches disabled and no User Administration.

So the claim that the roles can do the same is wrong for what the server allows, and right for what a visitor sees at first glance.

## 4. Resolved (branch `feat/role-aware-ui`)
The case page, the dashboard shortcut and the demo panel now show each role's limits (see `after_role_aware.json` and the screenshots here).
`test_frontend_permissions_mirror.py` keeps `frontend/lib/permissions.ts` in step with the server's lists (checked by changing one list: the test failed).
Not changed: every role can still read the v1.x data (design), and the "Investigate" shortcut on the dashboard still opens a fixed demo case
(`TEST-CASE-001`), as in v1.4.
