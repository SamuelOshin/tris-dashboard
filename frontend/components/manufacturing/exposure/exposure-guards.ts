import type { Dimension, ScenarioInputs } from './types'

/** Pure helpers for the scenario controls. Nothing here invents a figure. */

export const NO_CHANGE: ScenarioInputs = {
  price_change_pct: 0,
  demand_change_pct: 0,
  lead_time_delay_days: 0,
  inventory_change_pct: 0,
  supplier_id: null,
  supplier_price_change_pct: 0,
  spot_premium_pct: 0,
}

/** The limits the server enforces, so out-of-range entries are caught before sending. */
export const LIMITS: Record<keyof Omit<ScenarioInputs, 'supplier_id'>, [number, number]> = {
  price_change_pct: [-90, 500],
  demand_change_pct: [-100, 500],
  lead_time_delay_days: [0, 365],
  inventory_change_pct: [-100, 500],
  supplier_price_change_pct: [-90, 500],
  spot_premium_pct: [0, 500],
}

export function isNoChange(s: ScenarioInputs): boolean {
  return (
    s.price_change_pct === 0 &&
    s.demand_change_pct === 0 &&
    s.lead_time_delay_days === 0 &&
    s.inventory_change_pct === 0 &&
    s.supplier_price_change_pct === 0
  )
}

/** Returns a message for the first out-of-range field, or null when every entry is valid. */
export function validateScenario(s: ScenarioInputs): string | null {
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const value = s[field as keyof typeof LIMITS]
    if (!Number.isFinite(value) || value < min || value > max) {
      return `Enter a value between ${min} and ${max}.`
    }
  }
  if (s.supplier_price_change_pct !== 0 && !s.supplier_id) return 'Choose a supplier first.'
  return null
}

export const DIMENSION_LABEL: Record<Dimension, string> = {
  supplier: 'Supplier',
  product: 'Product',
  category: 'Category',
}

export function signedMoneyTone(value: number | null | undefined): string {
  if (value == null || Math.abs(value) < 0.005) return 'text-muted-foreground'
  return value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
}

/** Money totals: whole units from 100 up, two decimals below. Unit prices use formatMoney. */
export function formatAmount(value: number | null | undefined, currency?: string | null): string {
  if (value == null) return '—'
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : null
  const whole = Math.abs(value) >= 100
  return new Intl.NumberFormat('en-US', {
    style: code ? 'currency' : 'decimal',
    currency: code ?? undefined,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value)
}
