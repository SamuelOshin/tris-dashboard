import { RiskCase } from '@/lib/api'

/**
 * Predicates for Option A stage-based workflow locking.
 */
export function isInvestigationLocked(caseData: RiskCase | null): boolean {
  if (!caseData) return true
  return caseData.status === 'New' || caseData.status === 'Closed'
}

export function isCorrectiveLocked(caseData: RiskCase | null): boolean {
  if (!caseData) return true
  return (
    caseData.status === 'New' ||
    caseData.status === 'Assigned' ||
    caseData.status === 'Closed'
  )
}

export function isClosureLocked(caseData: RiskCase | null): boolean {
  if (!caseData) return true
  return !['Pending Verification', 'Closed'].includes(caseData.status)
}

/**
 * Returns Tailwind class names for the case priority badge.
 */
export function getPriorityBadgeStyle(priority?: string): string {
  const p = priority?.toLowerCase()
  if (p === 'high') {
    return 'bg-rose-500 text-white'
  }
  if (p === 'medium') {
    return 'bg-amber-500 text-white'
  }
  return 'bg-slate-500 text-white'
}

/**
 * Returns Tailwind class names for the case status badge.
 */
export function getStatusBadgeStyle(status?: string): string {
  if (status === 'Closed') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
  }
  if (status === 'Pending Verification') {
    return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300'
  }
  if (
    status === 'Under Investigation' ||
    status === 'Corrective Action' ||
    status === 'Assigned'
  ) {
    return 'bg-blue-600 text-white'
  }
  return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
}
