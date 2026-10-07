import type { WeightConfig } from './types'

/** Pure helpers for the administration screens. Nothing here invents a value. */

export function canAdminister(role?: string | null): boolean {
  return !!role && role.toLowerCase() === 'admin'
}

export const FACTOR_LABELS: Record<string, string> = {
  price_change: 'Price change',
  volatility: 'Price volatility',
  predicted_increase: 'Predicted increase',
  bom_exposure: 'Product cost exposure',
  demand: 'Demand trend',
  supplier_concentration: 'Supplier concentration',
  inventory_coverage: 'Inventory coverage',
  lead_time: 'Supplier lead time',
  standard_cost_deviation: 'Standard cost deviation',
}

export const BAND_LABELS: Record<string, string> = {
  moderate: 'Moderate from',
  high: 'High from',
  critical: 'Critical from',
}

export const LABEL_TEXT: Record<string, string> = {
  unlabelled: 'Not labelled',
  synthetic: 'Synthetic data',
  authorized: 'Authorised data',
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function weightTotal(weights: Record<string, number>): number {
  return Object.values(weights).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0)
}

/** A message for the first problem with a new weight set, or null when it can be saved. */
export function validateWeights(
  weights: Record<string, number>,
  bands: Record<string, number>,
  note: string
): string | null {
  if (Object.values(weights).some((v) => !Number.isFinite(v) || v < 0)) {
    return 'Every weight must be a number of zero or more.'
  }
  const total = weightTotal(weights)
  if (Math.abs(total - 100) > 1e-6) return `The weights must add up to 100 (they add up to ${total.toFixed(1)}).`
  const { moderate, high, critical } = bands
  if (![moderate, high, critical].every(Number.isFinite) || !(0 < moderate && moderate < high && high < critical && critical <= 100)) {
    return 'The bands must increase: moderate, then high, then critical, all above 0 and at most 100.'
  }
  if (note.trim().length < 5) return 'Say why the weights are changing (at least 5 characters).'
  return null
}

/** The new weight set: the edited weights and bands, with the scales and minimum coverage unchanged. */
export function buildConfig(
  active: WeightConfig,
  weights: Record<string, number>,
  bands: Record<string, number>
): WeightConfig {
  return { weights, ramps: active.ramps, bands, min_evaluable_weight: active.min_evaluable_weight }
}
