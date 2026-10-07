import {
  changeTone,
  formatMoney,
  formatMonth,
  formatPercent,
} from './material-cost-guards'
import { RiskBadge } from '../risk-score/risk-badge'
import type { ScoreSummary } from '../risk-score/types'
import { SignalChips } from './signal-chips'
import { InfoTip } from '@/components/onboarding/info-tip'
import type { MaterialRow } from './types'
import type { StoredResult } from '../dashboard/types'
import { ExposureCell, ForecastCell } from './stored-cells'

interface Props {
  rows: MaterialRow[]
  scores: Record<string, ScoreSummary>
  results: Record<string, StoredResult>
  onOpen: (materialId: string) => void
}

function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>
}

/** One row per material. Every number comes from the stored purchase, cost and stock records. */
export function MaterialsTable({ rows, scores, results, onOpen }: Props) {
  return (
    <div className="overflow-x-auto tris-surface">
      <table className="w-full min-w-[1400px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Material</th>
            <th className="px-3 py-2 font-medium">Current unit cost</th>
            <th className="px-3 py-2 font-medium">Last month</th>
            <th className="px-3 py-2 font-medium">Last 3 months</th>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Vs standard
                <InfoTip term="standardCost" />
              </span>
            </th>
            <th className="px-3 py-2 font-medium">12-month spend</th>
            <th className="px-3 py-2 font-medium">Main supplier</th>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Stock cover
                <InfoTip term="stockCover" />
              </span>
            </th>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Risk score
                <InfoTip term="riskScore" />
              </span>
            </th>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                30-day forecast
                <InfoTip term="forecast" />
              </span>
            </th>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                90-day forecast
                <InfoTip term="forecast" />
              </span>
            </th>
            <th className="px-3 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Exposure, 90 days
                <InfoTip term="projectedExposure" />
              </span>
            </th>
            <th className="px-3 py-2 font-medium">Signals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.material_id}
              onClick={() => onOpen(row.material_id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(row.material_id)}
              tabIndex={0}
              className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <Cell>
                <p className="font-medium text-foreground">{row.description}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {row.material_id}
                  {row.category && ` · ${row.category}`}
                </p>
              </Cell>
              <Cell>
                <p className="tabular-nums text-foreground">
                  {formatMoney(row.latest_price, row.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  per {row.unit_of_measure}
                  {row.latest_price_month && ` · ${formatMonth(row.latest_price_month)}`}
                </p>
              </Cell>
              <Cell className={`tabular-nums ${changeTone(row.price_change_1m_pct)}`}>
                {formatPercent(row.price_change_1m_pct)}
              </Cell>
              <Cell className={`tabular-nums ${changeTone(row.price_change_3m_pct)}`}>
                {formatPercent(row.price_change_3m_pct)}
              </Cell>
              <Cell className={`tabular-nums ${changeTone(row.vs_standard_pct)}`}>
                {row.vs_standard_pct == null ? (
                  <span className="text-xs text-muted-foreground">No standard</span>
                ) : (
                  formatPercent(row.vs_standard_pct)
                )}
              </Cell>
              <Cell className="tabular-nums">
                <p className="text-foreground">
                  {formatMoney(row.spend_window_total, row.currency)}
                </p>
                {row.spend_share_pct != null && (
                  <p className="text-xs text-muted-foreground">
                    {row.spend_share_pct.toFixed(1)}% of total
                  </p>
                )}
              </Cell>
              <Cell>
                {row.top_supplier ? (
                  <>
                    <p className="text-foreground">{row.top_supplier}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {row.top_supplier_share_pct?.toFixed(0)}% of spend
                    </p>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Not recorded</span>
                )}
              </Cell>
              <Cell className="tabular-nums">
                {row.coverage_days == null ? (
                  <span className="text-xs text-muted-foreground">No stock data</span>
                ) : (
                  `${Math.round(row.coverage_days)} days`
                )}
              </Cell>
              <Cell>
                <RiskBadge score={scores[row.material_id]} />
              </Cell>
              <Cell>
                <ForecastCell forecast={results[row.material_id]?.forecasts['30']} currency={row.currency} />
              </Cell>
              <Cell>
                <ForecastCell forecast={results[row.material_id]?.forecasts['90']} currency={row.currency} />
              </Cell>
              <Cell>
                <ExposureCell exposure={results[row.material_id]?.exposure} />
              </Cell>
              <Cell>
                <SignalChips signals={row.signals} />
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
