import { formatMoney, formatMonth } from '../material-cost/material-cost-guards'
import type { HistoryPoint, PathPoint } from './types'

const WIDTH = 720
const HEIGHT = 240
const PAD = { left: 12, right: 12, top: 14, bottom: 18 }

interface Props {
  history: HistoryPoint[]
  path: PathPoint[]
  currency: string | null
}

/** History (solid), forecast (dashed) and, only where the model supplies one, a prediction band. */
export function ForecastChart({ history, path, currency }: Props) {
  if (history.length < 2) {
    return <p className="text-sm text-muted-foreground">Not enough history to draw a chart.</p>
  }
  const total = history.length + path.length
  const values = [
    ...history.map((h) => h.unit_price),
    ...path.flatMap((p) => [p.value, p.lower ?? p.value, p.upper ?? p.value]),
  ]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => PAD.left + (i / (total - 1)) * (WIDTH - PAD.left - PAD.right)
  const y = (v: number) => HEIGHT - PAD.bottom - ((v - min) / span) * (HEIGHT - PAD.top - PAD.bottom)

  const historyLine = history.map((h, i) => `${x(i)},${y(h.unit_price)}`).join(' ')
  const lastIndex = history.length - 1
  const forecastLine = [
    `${x(lastIndex)},${y(history[lastIndex].unit_price)}`,
    ...path.map((p, i) => `${x(history.length + i)},${y(p.value)}`),
  ].join(' ')
  const banded = path.filter((p) => p.lower != null && p.upper != null)
  const band =
    banded.length === path.length && path.length > 0
      ? [
          `${x(lastIndex)},${y(history[lastIndex].unit_price)}`,
          ...path.map((p, i) => `${x(history.length + i)},${y(p.upper as number)}`),
          ...path.map((p, i) => `${x(history.length + i)},${y(p.lower as number)}`).reverse(),
        ].join(' ')
      : null
  const first = history[0]
  const lastForecast = path[path.length - 1]

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Monthly purchase price history and forecast"
        className="w-full rounded-lg border border-border bg-background"
      >
        {band && <polygon points={band} className="fill-primary/15" />}
        <polyline points={historyLine} fill="none" strokeWidth="2" className="stroke-foreground" />
        <polyline
          points={forecastLine}
          fill="none"
          strokeWidth="2"
          strokeDasharray="5 4"
          className="stroke-primary"
        />
        {path.map((p, i) => (
          <circle key={p.month} cx={x(history.length + i)} cy={y(p.value)} r="3.5" className="fill-primary" />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatMonth(first.month)} · {formatMoney(first.unit_price, currency)}
        </span>
        <span>
          {formatMonth(lastForecast.month)} · forecast {formatMoney(lastForecast.value, currency)}
        </span>
      </figcaption>
      <p className="mt-1 text-xs text-muted-foreground">
        Solid line: monthly purchase price. Dashed line: forecast.
        {band
          ? ' Shaded area: the range the model expects the price to fall in.'
          : ' This model does not provide a range, so none is shown.'}
      </p>
    </figure>
  )
}
