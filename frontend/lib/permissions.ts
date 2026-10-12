/**
 * What each role may do, mirrored from the server (`backend/app/api/core/permissions.py`).
 *
 * The server is the authority and refuses anything a role may not do. These functions only let the
 * screens show the same limits up front (a disabled button and a short reason) instead of letting
 * someone click and be refused. When the server's lists change, change these too.
 */

type Role = string | undefined | null

const norm = (role: Role) => (role ?? '').toLowerCase()
const among = (role: Role, allowed: readonly string[]) => allowed.includes(norm(role))

/** Import a workbook (server: WRITE_ROLES). */
export const IMPORT_ROLES = ['admin', 'compliance', 'reviewer'] as const
/** Change a case: accept, save, advance (server: CASE_TRANSITION_ROLES). */
export const CASE_WORK_ROLES = ['admin', 'reviewer', 'verifier', 'process_owner'] as const
/** Close a case after verification (server: CASE_VERIFICATION_ROLES). */
export const CASE_CLOSE_ROLES = ['admin', 'verifier'] as const

/** Read-only roles: see everything, change and run nothing (server: READ_ONLY_ROLES). */
export const READ_ONLY_ROLES = ['read_only_reviewer'] as const

export const canImportData = (role: Role) => among(role, IMPORT_ROLES)
export const canWorkCases = (role: Role) => among(role, CASE_WORK_ROLES)
export const canCloseCases = (role: Role) => among(role, CASE_CLOSE_ROLES)
/** Run a remediation replay simulation: every signed-in role except read-only (server: NON_READ_ONLY_ROLES). */
export const canRunHistory = (role: Role) => norm(role) !== '' && !among(role, READ_ONLY_ROLES)

export interface RoleSummary {
  label: string
  can: string[]
  cannot: string[]
}

const SUMMARIES: Record<string, RoleSummary> = {
  admin: {
    label: 'System Administrator',
    can: [
      'Do everything the other roles can',
      'Manage users, detection rules, forecast models and risk weights',
      'Read the audit log',
    ],
    cannot: ['Close a case you worked on yourself'],
  },
  reviewer: {
    label: 'Risk Reviewer',
    can: [
      'Import data and run forecasts, scoring and validation',
      'Open and investigate cases, and send them for verification',
    ],
    cannot: ['Close a case (a verifier does that)', 'Manage users or rules, or open Administration'],
  },
  read_only_reviewer: {
    label: 'Read-Only Reviewer',
    can: ['See every dashboard, result, case and document', 'Try a what-if scenario (nothing is saved)'],
    cannot: ['Change anything', 'Import data, run forecasts, work on cases or run replay simulations'],
  },
  verifier: {
    label: 'Compliance Verifier',
    can: ['Review cases', 'Verify and close cases you did not investigate'],
    cannot: ['Import data', 'See Manufacturing', 'Change rules or users'],
  },
  process_owner: {
    label: 'Process Owner',
    can: ['Work cases up to verification', 'Review how a decision would have gone at the time'],
    cannot: ['Import data', 'See Manufacturing', 'Close a case'],
  },
}

const FALLBACK: RoleSummary = {
  label: 'Your role',
  can: ['See the dashboards and cases your role allows'],
  cannot: ['Anything the system refuses for your role'],
}

export function roleSummary(role: Role): RoleSummary {
  return SUMMARIES[norm(role)] ?? FALLBACK
}
