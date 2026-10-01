import { formatMoney, formatMonth } from './material-cost-guards'
import type { PricePoint } from './types'

const WIDTH = 420
const HEIGHT = 110
const PAD = 8

function scale(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return (v: number) => HEIGHT - PAD - ((v - min) / span) * (HEIGHT - PAD * 2)
}

/** Monthly purchase price (line) against standard cost (dashed), drawn from stored data only. */
export function PriceTrend({ points, currency }: { points: PricePoint[]; currency: string | null }) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        A trend needs purchases in at least two months; this material has {points.length}.
      </p>
    )
  }
  const values = points.flatMap((p) => [p.unit_price, p.standard_cost ?? p.unit_price])
  const y = scale(values)
  const x = (i: number) => PAD + (i / (points.length - 1)) * (WIDTH - PAD * 2)
  const line = points.map((p, i) => `${x(i)},${y(p.unit_price)}`).join(' ')
  const standard = points
    .map((p, i) => (p.standard_cost == null ? null : `${x(i)},${y(p.standard_cost)}`))
    .filter(Boolean)
    .join(' ')
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Monthly purchase price trend"
        className="w-full rounded-lg border border-border bg-background"
      >
        {standard && (
          <polyline points={standard} fill="none" stroke="currentColor" strokeDasharray="4 4"
            className="text-muted-foreground" strokeWidth="1.5" />
        )}
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2"
          className="text-primary" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{formatMonth(first.month)} · {formatMoney(first.unit_price, currency)}</span>
        <span>{formatMonth(last.month)} · {formatMoney(last.unit_price, currency)}</span>
      </div>
      {standard && (
        <p className="mt-1 text-xs text-muted-foreground">Dashed line: standard cost in force.</p>
      )}
    </div>
  )
}
