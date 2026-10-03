import type { RunRequest } from './types'

/** Pure helpers. Nothing here invents a result; a missing figure is shown as a dash. */

const RUN_ROLES = ['admin', 'reviewer']

export function canRunValidation(role?: string | null): boolean {
  return !!role && RUN_ROLES.includes(role.toLowerCase())
}

export function ratio(value: number | null | undefined, digits = 0): string {
  return value == null ? '—' : `${(value * 100).toFixed(digits)}%`
}

export function pct(value: number | null | undefined, digits = 1): string {
  return value == null ? '—' : `${value.toFixed(digits)}%`
}

export function num(value: number | null | undefined, digits = 2): string {
  return value == null ? '—' : value.toFixed(digits)
}

export const DEFAULT_REQUEST: RunRequest = {
  horizons_days: [30, 90],
  cutoff_step_months: 1,
  event_threshold_pct: 5,
  alert_threshold: null,
  note: null,
}

/** A message for the first invalid entry, or null when the request can be sent. */
export function validateRequest(r: RunRequest): string | null {
  if (r.horizons_days.length === 0) return 'Choose at least one outlook.'
  if (!Number.isFinite(r.event_threshold_pct) || r.event_threshold_pct <= 0 || r.event_threshold_pct > 100) {
    return 'The price rise that counts as a risk event must be between 0 and 100.'
  }
  if (r.alert_threshold != null && (!Number.isFinite(r.alert_threshold) || r.alert_threshold < 0 || r.alert_threshold > 100)) {
    return 'The warning score must be between 0 and 100.'
  }
  return null
}

export function statusTone(status: string): string {
  return status === 'completed'
    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
}
