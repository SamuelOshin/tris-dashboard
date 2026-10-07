import { formatDate, formatTimestamp } from '../material-cost/material-cost-guards'
import { statusTone } from './validation-guards'
import type { RunListItem } from './types'

interface Props {
  runs: RunListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Every run is listed, including runs that did not finish: none is ever removed. */
export function RunList({ runs, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-x-auto tris-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Run</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Cases</th>
            <th className="px-3 py-2 font-medium">Settings</th>
            <th className="px-3 py-2 font-medium">Data up to</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((r) => (
            <tr
              key={r.run_id}
              tabIndex={0}
              aria-selected={r.run_id === selectedId}
              onClick={() => onSelect(r.run_id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(r.run_id)}
              className={`cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none ${
                r.run_id === selectedId ? 'bg-muted/30' : ''
              }`}
            >
              <td className="px-3 py-2.5">
                <p className="font-mono text-xs font-semibold text-foreground">{r.run_id}</p>
                <p className="text-[11px] text-muted-foreground">{formatTimestamp(r.created_at)}</p>
                {r.note && <p className="text-[11px] text-muted-foreground">{r.note}</p>}
                {r.failure && <p className="max-w-xs text-[11px] text-amber-700 dark:text-amber-400">{r.failure.message}</p>}
              </td>
              <td className="px-3 py-2.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(r.status)}`}>
                  {r.status === 'completed' ? 'Completed' : 'Did not finish'}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                {r.cases == null ? '—' : `${r.evaluated} of ${r.cases} judged`}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {r.config.horizons_days.join(' and ')}-day · risk event +{r.config.event_threshold_pct}% · warning at{' '}
                {r.config.alert_threshold}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(r.data_end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
