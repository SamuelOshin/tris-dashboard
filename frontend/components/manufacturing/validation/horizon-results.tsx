import { num, pct, ratio } from './validation-guards'
import type { HorizonMetrics } from './types'

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  )
}

function Matrix({ w }: { w: HorizonMetrics['warning'] }) {
  const cell = 'px-3 py-2 text-center tabular-nums'
  return (
    <table className="w-full max-w-xs text-xs" aria-label="Warnings against what happened">
      <thead>
        <tr className="text-muted-foreground">
          <th className="px-3 py-1 text-left font-medium" />
          <th className="px-3 py-1 font-medium">Risk event</th>
          <th className="px-3 py-1 font-medium">No event</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border rounded-lg border border-border">
        <tr>
          <th className="px-3 py-2 text-left font-medium text-foreground">Warning raised</th>
          <td className={`${cell} text-emerald-600 dark:text-emerald-400`}>{w.tp} correct</td>
          <td className={`${cell} text-amber-600 dark:text-amber-400`}>{w.fp} false alarms</td>
        </tr>
        <tr>
          <th className="px-3 py-2 text-left font-medium text-foreground">No warning</th>
          <td className={`${cell} text-red-600 dark:text-red-400`}>{w.fn} missed</td>
          <td className={`${cell} text-muted-foreground`}>{w.tn} correct</td>
        </tr>
      </tbody>
    </table>
  )
}

/** Accuracy of one outlook: the forecast, the warning, how early it came, and each material. */
export function HorizonResults({ days, h }: { days: string; h: HorizonMetrics }) {
  const f = h.forecast
  return (
    <section className="space-y-4 tris-surface p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{days}-day outlook</h3>
        <p className="text-xs text-muted-foreground">
          {h.cases} cases: {h.evaluated} judged, {h.withheld} without enough history to forecast, {h.not_evaluable} whose
          result is not in the data yet.
        </p>
      </div>
      {f.n === 0 ? (
        <p className="text-sm text-muted-foreground">No case could be judged for this outlook.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Typical error (MAPE)" value={pct(f.mape_pct)} note="Average gap to the real price" />
          <Stat
            label="Direction right"
            value={ratio(f.directional_accuracy)}
            note={`${f.directional_n} calls · ${f.directional_no_call_n ?? 0} said "no change" while the price moved`}
          />
          <Stat
            label="Against 'same as now'"
            value={`${ratio(f.beats_naive_share)} better`}
            note={`${ratio(f.ties_naive_share)} equal · ${ratio(f.worse_than_naive_share)} worse`}
          />
          <Stat label="Error in price units" value={`${num(f.mae)} / ${num(f.rmse)}`} note="MAE / RMSE, mixed scales" />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground">Warning quality</h4>
          <Matrix w={h.warning} />
          <p className="text-[11px] text-muted-foreground">
            Precision {ratio(h.warning.precision)} · recall {ratio(h.warning.recall)} · false alarm rate{' '}
            {ratio(h.warning.false_positive_rate)} · miss rate {ratio(h.warning.false_negative_rate)} · events{' '}
            {h.warning.events} of {h.warning.n} cases
          </p>
          {!!h.warning.unscored && (
            <p className="text-[11px] text-muted-foreground">
              {h.warning.unscored} case(s) had too little data to score and count as no warning
              {h.warning.unscored_events ? ` (${h.warning.unscored_events} of them were risk events, counted as missed)` : ''}.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground">Advance warning</h4>
          {h.lead_time.n === 0 ? (
            <p className="text-xs text-muted-foreground">No risk event was warned about in advance.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {h.lead_time.n} event(s) were warned about: on average {num(h.lead_time.mean_months, 1)} months ahead
              (median {num(h.lead_time.median_months, 1)}, from {h.lead_time.min_months} to {h.lead_time.max_months}).
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Models chosen: {Object.entries(h.models).map(([m, n]) => `${m} (${n})`).join(', ') || '—'}
          </p>
        </div>
      </div>
      {h.by_material.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Material</th>
                <th className="py-1.5 pr-3 font-medium">Cases</th>
                <th className="py-1.5 pr-3 font-medium">MAPE</th>
                <th className="py-1.5 pr-3 font-medium">MAE (own units)</th>
                <th className="py-1.5 pr-3 font-medium">Direction right</th>
                <th className="py-1.5 font-medium">Risk events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {h.by_material.map((m) => (
                <tr key={m.material_id}>
                  <td className="py-1.5 pr-3 font-mono text-foreground">{m.material_id}</td>
                  <td className="py-1.5 pr-3">{m.n}</td>
                  <td className="py-1.5 pr-3">{pct(m.mape_pct)}</td>
                  <td className="py-1.5 pr-3">{num(m.mae)}</td>
                  <td className="py-1.5 pr-3">{ratio(m.directional_accuracy)}</td>
                  <td className="py-1.5">{m.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
