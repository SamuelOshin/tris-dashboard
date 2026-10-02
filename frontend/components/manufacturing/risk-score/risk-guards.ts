import type { RiskLevel } from './types'

/** Roles that may calculate (and so store) risk scores; viewing stored scores is wider. */
const RUN_ROLES = ['admin', 'reviewer']

export function canRunScoring(role?: string | null): boolean {
  return !!role && RUN_ROLES.includes(role.toLowerCase())
}

export const LEVEL_TONE: Record<RiskLevel, string> = {
  Low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  Moderate: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  High: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
  Critical: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
}

/** Width (0-100) of a factor's bar: how much of its configured weight it adds to the score. */
export function barWidth(points: number, effectiveWeightPct: number): number {
  if (effectiveWeightPct <= 0) return 0
  return Math.min(100, Math.max(0, (points / effectiveWeightPct) * 100))
}
