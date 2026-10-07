import { formatDate, formatTimestamp } from '../material-cost/material-cost-guards'
import { InfoTip } from '@/components/onboarding/info-tip'
import { number, percent } from './forecast-guards'
import type { ForecastRun } from './types'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

/** Model name and version, dataset version, dates and horizon, and how the model was chosen. */
export function ModelDetails({ run }: { run: ForecastRun }) {
  return (
    <section className="space-y-4 tris-surface p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        How this forecast was made
        <InfoTip term="forecastRange" />
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Model" value={`${run.model.name} (version ${run.model.version})`} />
        <Field label="Dataset version" value={run.dataset_version} />
        <Field label="Horizon" value={`${run.horizon_days} days (${run.horizon_months} month${run.horizon_months > 1 ? 's' : ''} ahead)`} />
        <Field label="Data used up to" value={formatDate(run.as_of)} />
        <Field label="History" value={`${run.history.months} ${run.history.frequency} periods, ${formatDate(run.history.start)} to ${formatDate(run.history.end)}`} />
        <Field label="Forecast saved" value={formatTimestamp(run.created_at)} />
      </dl>
      <div>
        <h3 className="text-sm font-medium text-foreground">Why this model</h3>
        <p className="mt-1 text-sm text-muted-foreground">{run.selection_rationale}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground">Models compared on held-out months</h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Avg. error (MAE)</th>
                <th className="px-3 py-2 font-medium">RMSE</th>
                <th className="px-3 py-2 font-medium">Error %</th>
                <th className="px-3 py-2 font-medium">Direction right</th>
              </tr>
            </thead>
            <tbody>
              {run.candidates.map((c) => (
                <tr key={c.code} className={`border-t border-border ${c.selected ? 'bg-primary/5' : ''}`}>
                  <td className="px-3 py-1.5">
                    <span className="text-foreground">{c.name}</span>
                    {c.selected && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Chosen</span>}
                    {!c.eligible && <span className="ml-2 text-muted-foreground">{c.note}</span>}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{number(c.mae)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{number(c.rmse)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{c.mape == null ? '—' : `${c.mape.toFixed(1)}%`}</td>
                  <td className="px-3 py-1.5 tabular-nums">{percent(c.directional_accuracy, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Each model was tested on {run.config.origins ?? 'several'} recent months it had not seen,
          using only the data before each month. With so few test months the comparison is a guide,
          not proof.
        </p>
      </div>
    </section>
  )
}
