import { formatPercent } from '../material-cost/material-cost-guards'
import { formatAmount, signedMoneyTone } from './exposure-guards'
import type { RollupBlock } from './types'

function Figure({ label, value, currency, tone, note }: {
  label: string
  value: number
  currency: string
  tone?: string
  note?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? 'text-foreground'}`}>
        {formatAmount(value, currency)}
      </p>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  )
}

/** Totals per currency. Currencies are shown separately and never added together. */
export function ExposureSummary({ blocks, isScenario }: { blocks: RollupBlock[]; isScenario: boolean }) {
  return (
    <div className="space-y-3">
      {blocks.map((b) => {
        const t = b.total
        const pct = t.baseline_spend ? (t.projected_exposure / t.baseline_spend) * 100 : null
        return (
          <div key={b.currency} className="space-y-2">
            {blocks.length > 1 && <p className="text-xs font-medium text-muted-foreground">{b.currency}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Spend at latest prices" value={t.baseline_spend} currency={b.currency} />
              <Figure label="Spend at forecast prices" value={t.forecast_spend} currency={b.currency} />
              <Figure
                label="Projected exposure"
                value={t.projected_exposure}
                currency={b.currency}
                tone={signedMoneyTone(t.projected_exposure)}
                note={pct == null ? undefined : `${formatPercent(pct)} of spend at latest prices`}
              />
              {isScenario && t.scenario_exposure != null && (
                <Figure
                  label="Scenario exposure"
                  value={t.scenario_exposure}
                  currency={b.currency}
                  tone={signedMoneyTone(t.scenario_exposure)}
                  note={`${formatAmount(t.change_vs_baseline, b.currency)} vs projected exposure`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
