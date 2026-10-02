import type { Horizon } from './types'

/** Roles that may run (and so store) a forecast; viewing stored forecasts is wider. */
const RUN_ROLES = ['admin', 'reviewer']

export function canRunForecast(role?: string | null): boolean {
  return !!role && RUN_ROLES.includes(role.toLowerCase())
}

export function horizonLabel(days: number): string {
  return `${days}-day outlook`
}

/** The horizon to show first: a stored forecast if there is one, otherwise the first one. */
export function defaultHorizon(horizons: Horizon[]): number | null {
  const withForecast = horizons.find((h) => h.status === 'forecast')
  return (withForecast ?? horizons[0])?.horizon_days ?? null
}

export function percent(value: number | null | undefined, digits = 1): string {
  return value == null ? '—' : `${(value * 100).toFixed(digits)}%`
}

export function number(value: number | null | undefined, digits = 4): string {
  return value == null ? '—' : value.toFixed(digits)
}
