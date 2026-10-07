import { formatMoney, formatPercent } from '../material-cost/material-cost-guards'
import { formatAmount, signedMoneyTone } from './exposure-guards'
import type { MaterialExposure } from './types'

function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top tabular-nums ${className}`}>{children}</td>
}

function ScenarioCell({ row }: { row: MaterialExposure }) {
  const s = row.scenario
  if (!s) return null
  return (
    <Cell className={signedMoneyTone(s.scenario_exposure)}>
      {formatAmount(s.scenario_exposure, row.currency)}
      <p className="text-[11px] text-muted-foreground">
        price {formatAmount(s.price_effect, row.currency)} · volume {formatAmount(s.volume_effect, row.currency)}
        {s.premium_cost > 0 && ` · rush-buy ${formatAmount(s.premium_cost, row.currency)}`}
      </p>
      {s.notes.map((n) => (
        <p key={n} className="text-[11px] text-amber-600 dark:text-amber-400">
          {n}
        </p>
      ))}
    </Cell>
  )
}

/** One row per material, straight from its stored forecast and recent purchases. */
export function ExposureTable({ rows, isScenario }: { rows: MaterialExposure[]; isScenario: boolean }) {
  return (
    <div className="overflow-x-auto tris-surface">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Material</th>
            <th className="px-3 py-2 font-medium">Latest price</th>
            <th className="px-3 py-2 font-medium">Forecast price</th>
            <th className="px-3 py-2 font-medium">Expected usage</th>
            <th className="px-3 py-2 font-medium">Projected exposure</th>
            {isScenario && <th className="px-3 py-2 font-medium">Scenario exposure</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.material_id}>
              <td className="px-3 py-2.5 align-top">
                <p className="font-medium text-foreground">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {r.material_id} · {r.forecast.model}
                </p>
                {r.stale_note && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{r.stale_note}</p>
                )}
              </td>
              <Cell>{formatMoney(r.baseline_unit_cost, r.currency)}</Cell>
              <Cell>{formatMoney(r.forecast_unit_cost, r.currency)}</Cell>
              <Cell>
                {Math.round(r.expected_usage).toLocaleString('en-US')} {r.unit_of_measure}
                <p className="text-[11px] text-muted-foreground">
                  from the last {r.usage_basis.months_used} months of purchases
                </p>
              </Cell>
              <Cell className={signedMoneyTone(r.projected_exposure)}>
                {formatAmount(r.projected_exposure, r.currency)}
                <p className="text-[11px] text-muted-foreground">{formatPercent(r.exposure_pct)}</p>
              </Cell>
              {isScenario && <ScenarioCell row={r} />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
