import { formatCurrency } from '@/lib/api'
import { SvgPoint } from '../types'

/**
 * Currency and date formatting utility helpers for the overview dashboard.
 */

/** Formats an amount as whole dollars, dropping the decimal separator (e.g. "$104,000"). */
export function formatWhole(amount: number): string {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount || 0)
  return parts
    .filter((p) => p.type !== 'decimal' && p.type !== 'fraction')
    .map((p) => p.value)
    .join('')
}

/** Formats only the cents portion of an amount, zero-padded (e.g. ".00"). */
export function formatCents(amount: number): string {
  const cents = Math.round((Math.abs(amount || 0) % 1) * 100)
  return `.${String(cents).padStart(2, '0')}`
}

/** Compact currency for chart axis ticks (e.g. "$104.0k"). */
export function formatCurrencyK(amount: number): string {
  if (!amount || amount === 0) return '$0'
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return formatCurrency(amount)
}

/** Month/year label for an ISO date string, with an honest fallback. */
export function formatMonthYear(dateStr?: string): string {
  if (!dateStr) return 'Current Cycle'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Current Cycle'
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  } catch {
    return 'Current Cycle'
  }
}

/**
 * Mathematically converts an array of 2D points into a smooth Catmull-Rom
 * cubic Bezier SVG path string.
 */
export function generateSplinePath(points: SvgPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}
