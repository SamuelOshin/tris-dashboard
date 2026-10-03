import { formatMonth } from '../material-cost/material-cost-guards'
import { pct } from './validation-guards'
import type { ProblemCase, RunDetail } from './types'

function CaseTable({ title, note, rows }: { title: string; note: string; rows: ProblemCase[] }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-foreground">
        {title} ({rows.length})
      </h4>
      <p className="text-[11px] text-muted-foreground">{note}</p>
      {rows.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="sticky top-0 border-b border-border bg-card text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Material</th>
                <th className="px-2 py-1.5 font-medium">Date</th>
                <th className="px-2 py-1.5 font-medium">Outlook</th>
                <th className="px-2 py-1.5 font-medium">Risk score</th>
                <th className="px-2 py-1.5 font-medium">Forecast move</th>
                <th className="px-2 py-1.5 font-medium">Actual move</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {rows.map((r) => (
                <tr key={r.case_id}>
                  <td className="px-2 py-1.5 font-mono text-foreground">{r.material_id}</td>
                  <td className="px-2 py-1.5">{formatMonth(r.cutoff.slice(0, 8) + '01')}</td>
                  <td className="px-2 py-1.5">{r.horizon_days} d</td>
                  <td className="px-2 py-1.5">{r.risk_score == null ? '—' : r.risk_score.toFixed(1)}</td>
                  <td className="px-2 py-1.5">{pct(r.forecast_change_pct)}</td>
                  <td className="px-2 py-1.5">{pct(r.actual_change_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** What did not work, kept and shown in full: false alarms, misses, gaps and what is not a clean result. */
export function ProblemsPanel({ run }: { run: RunDetail }) {
  const p = run.problems
  if (!p) return null
  const gaps = Object.entries(p.not_forecast_or_evaluated)
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Problems and gaps</h3>
      <p className="text-xs text-muted-foreground">
        {p.worse_than_naive_cases} judged case(s) were further from the real price than simply assuming it would stay
        the same.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <CaseTable
          title="False alarms"
          note="A warning was raised but the price did not rise enough."
          rows={p.false_positives}
        />
        <CaseTable title="Missed events" note="The price rose enough but no warning was raised." rows={p.false_negatives} />
      </div>
      {gaps.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {gaps.map(([reason, n]) => (
            <li key={reason}>
              {n} case(s) — {reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
