import { Clock, Info } from 'lucide-react'
import { changeTone, formatMoney, formatMonth, formatPercent } from '../material-cost/material-cost-guards'
import { horizonLabel } from './forecast-guards'
import type { Horizon } from './types'

interface Props {
  horizons: Horizon[]
  currency: string | null
  active: number | null
  onSelect: (days: number) => void
}

function Withheld({ horizon }: { horizon: Horizon }) {
  return (
    <div className="mt-3 flex gap-2 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium text-foreground">Not shown</p>
        <p>
          {horizon.reason} A forecast is only shown when the history can support it, so none has
          been made up.
        </p>
      </div>
    </div>
  )
}

function Forecast({ horizon, currency }: { horizon: Horizon; currency: string | null }) {
  const run = horizon.run
  if (!run) return null
  const f = run.forecast
  return (
    <div className="mt-3 space-y-1">
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {formatMoney(f.value, currency)}
      </p>
      <p className="text-sm text-muted-foreground">
        expected for {formatMonth(f.month)}
        {f.change_pct != null && (
          <>
            {' · '}
            <span className={changeTone(f.change_pct)}>{formatPercent(f.change_pct)}</span> vs latest
          </>
        )}
      </p>
      {f.lower != null && f.upper != null ? (
        <p className="text-xs text-muted-foreground">
          {Math.round((f.interval_level ?? 0) * 100)}% range: {formatMoney(f.lower, currency)} to{' '}
          {formatMoney(f.upper, currency)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No range: this model does not provide one.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {run.model.name} v{run.model.version}
      </p>
    </div>
  )
}

export function HorizonCards({ horizons, currency, active, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {horizons.map((h) => {
        const selected = active === h.horizon_days
        const clickable = h.status === 'forecast'
        return (
          <button
            key={h.horizon_days}
            type="button"
            disabled={!clickable}
            aria-pressed={selected}
            onClick={() => onSelect(h.horizon_days)}
            className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-default ${
              selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
            } ${clickable ? 'hover:bg-muted/40' : ''}`}
          >
            <p className="text-sm font-semibold text-foreground">{horizonLabel(h.horizon_days)}</p>
            {h.status === 'forecast' && <Forecast horizon={h} currency={currency} />}
            {h.status === 'withheld' && <Withheld horizon={h} />}
            {h.status === 'not_run' && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" /> No forecast has been run yet.
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
