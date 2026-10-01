import { Download } from 'lucide-react'
import { mappingApi } from './mapping-api'
import type { ErrorLogEntry } from './types'

const VISIBLE_ROWS = 50

interface Props {
  entries: ErrorLogEntry[]
  total: number
  jobId: string | null
}

function sourceSnippet(raw: Record<string, unknown>): string {
  return Object.entries(raw)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ')
}

/** Row-level reasons for every rejected row, with a CSV download after a real import. */
export function ErrorLogTable({ entries, total, jobId }: Props) {
  if (entries.length === 0) return null
  const shown = entries.slice(0, VISIBLE_ROWS)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Rejected rows ({total.toLocaleString()} {total === 1 ? 'issue' : 'issues'})
        </h3>
        {jobId && (
          <a
            href={mappingApi.errorLogUrl(jobId)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="size-3.5" />
            Download full log (CSV)
          </a>
        )}
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">Field</th>
              <th className="px-3 py-2 font-medium">Problem</th>
              <th className="px-3 py-2 font-medium">Source values</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={`${e.row}-${e.field}-${i}`} className="border-t border-border align-top">
                <td className="px-3 py-1.5 font-mono">{e.row > 0 ? e.row : '—'}</td>
                <td className="px-3 py-1.5 font-medium text-foreground">{e.field}</td>
                <td className="px-3 py-1.5 text-foreground">{e.error}</td>
                <td className="max-w-xs truncate px-3 py-1.5 font-mono text-muted-foreground">
                  {sourceSnippet(e.raw_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > shown.length && (
        <p className="text-xs text-muted-foreground">
          Showing the first {shown.length} of {total.toLocaleString()} issues.
        </p>
      )}
    </div>
  )
}
