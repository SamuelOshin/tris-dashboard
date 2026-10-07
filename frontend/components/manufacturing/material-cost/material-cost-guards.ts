import type { Filters, SignalStatus } from './types'
import { EMPTY_FILTERS } from './types'

/** Pure display helpers; no figure is ever invented here, only formatted. */

export function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (value == null) return '—'
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : null
  return new Intl.NumberFormat('en-US', {
    style: code ? 'currency' : 'decimal',
    currency: code ?? undefined,
    // Large amounts are shown in whole units; unit prices keep up to four decimals.
    minimumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 4,
  }).format(value)
}

export function formatPercent(value: number | null | undefined, signed = true): string {
  if (value == null) return '—'
  const sign = signed && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatMonth(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

/** A price rise is the adverse direction for a cost risk view. */
export function changeTone(value: number | null | undefined): string {
  if (value == null || Math.abs(value) < 0.05) return 'text-muted-foreground'
  return value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
}

export const STATUS_LABEL: Record<SignalStatus, string> = {
  triggered: 'Signal',
  clear: 'Clear',
  not_evaluable: 'Not enough data',
}

export function hasActiveFilters(filters: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).some(
    (key) => key !== 'asOf' && filters[key] !== EMPTY_FILTERS[key]
  )
}
