import Link from 'next/link'
import { formatMoney, formatPercent } from '../material-cost/material-cost-guards'
import { RiskLevelPill } from './risk-level-pill'
import type { TopExposureRow } from './types'

/** Materials with the largest projected exposure, ranked within each currency. */
export function TopExposureTable({ rows }: { rows: TopExposureRow[] }) {
  return (
    <div className="tris-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Top materials by projected exposure</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        From the stored 90-day forecasts. Ranked separately for each currency.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No 90-day forecasts are saved yet. Run them on the Forecasting &amp; Scenarios page.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Material</th>
                <th className="py-1.5 pr-3 font-medium">Projected exposure</th>
                <th className="py-1.5 pr-3 font-medium">30-day change</th>
                <th className="py-1.5 font-medium">Risk and case</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.currency}-${row.material_id}`} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/manufacturing/material-cost?material=${encodeURIComponent(row.material_id)}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {row.description}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{row.material_id}</p>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    <p className="text-foreground">
                      {row.projected_exposure > 0 ? '+' : ''}
                      {formatMoney(row.projected_exposure, row.currency)}
                    </p>
                    {row.exposure_pct != null && (
                      <p className="text-xs text-muted-foreground">
                        {formatPercent(row.exposure_pct)} of spend
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-foreground">
                    {formatPercent(row.change_pct_30d)}
                  </td>
                  <td className="py-2">
                    <RiskLevelPill level={row.level} />
                    {row.open_case ? (
                      <Link
                        href={`/cases/${row.open_case.case_id}`}
                        className="mt-1 block font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {row.open_case.case_number}
                      </Link>
                    ) : (
                      <span className="mt-1 block text-xs text-muted-foreground">No open case</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
