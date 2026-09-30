'use client'

import { Calendar, CheckCircle2 } from 'lucide-react'
import { RiskCase, formatCurrency } from '@/lib/api'
import { ChartData, MonthlyBucket } from '../types'

export interface SplineLedgerChartData {
  chartData: ChartData | null
  monthlyBuckets: MonthlyBucket[]
  focusBucket: MonthlyBucket | null
  benchmarkCase: RiskCase | null
  transactionCount: number
}

/**
 * Right column of the hero card: the monthly ledger telemetry spline chart with a
 * pinned tooltip, or an honest empty state when the ledger spans fewer than two
 * periods.
 */
export function SplineLedgerChart({
  chartData,
  monthlyBuckets,
  focusBucket,
  benchmarkCase,
  transactionCount,
}: SplineLedgerChartData) {
  return (
    <div className="lg:col-span-7 relative bg-muted/15 dark:bg-muted/10 rounded-2xl p-3.5 sm:p-5 overflow-hidden">
      {chartData && focusBucket ? (
        <>
          {/* Pinned Tooltip Card: Aligned with the plotted monthly aggregate values */}
          <div className="mb-3 sm:mb-0 sm:absolute sm:top-4 sm:right-4 sm:z-10 bg-card dark:bg-[#1d2027] p-3 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] border-0 text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-200 max-w-full">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <span>
                {focusBucket.monthName} {focusBucket.year}
                {focusBucket.hasAnomaly && benchmarkCase
                  ? ` · ${benchmarkCase.transaction_id}`
                  : ' · All Cleared'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    focusBucket.hasAnomaly ? 'bg-destructive' : 'bg-success'
                  }`}
                />
                <span className="text-[11px] text-muted-foreground">
                  {focusBucket.hasAnomaly ? 'Monitored Total' : 'Audited Total'}
                </span>
              </div>
              <span className="font-mono font-bold text-foreground text-xs">
                {formatCurrency(focusBucket.totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[11px] text-muted-foreground">Standard Baseline</span>
              </div>
              <span className="font-mono font-bold text-foreground text-xs">
                {formatCurrency(focusBucket.standardAmount)}
              </span>
            </div>
          </div>

          {/* SVG Telemetry Spline Visualization */}
          <div className="w-full h-40 sm:h-52 overflow-x-auto">
            <svg
              viewBox="0 0 600 220"
              className="w-full h-full min-w-[300px] overflow-visible"
            >
              <defs>
                <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.60 0.22 25)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="oklch(0.60 0.22 25)" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.58 0.22 260)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="oklch(0.58 0.22 260)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {chartData.yTicks.map((tick) => (
                <line
                  key={tick.y}
                  x1="20"
                  y1={tick.y}
                  x2="580"
                  y2={tick.y}
                  stroke="currentColor"
                  strokeOpacity="0.06"
                  strokeDasharray="3 3"
                />
              ))}

              {/* Y-axis Labels */}
              {chartData.yTicks.map((tick) => (
                <text
                  key={tick.y}
                  x="585"
                  y={tick.y + 4}
                  fill="currentColor"
                  fillOpacity="0.3"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {tick.label}
                </text>
              ))}

              {/* Baseline Smooth Spline Curve (Calm Blue Wave) */}
              <path
                d={chartData.baselinePath}
                fill="none"
                stroke="oklch(0.58 0.22 260)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Anomaly Spline Curve & Gradient (Only rendered when anomalies exist) */}
              {chartData.hasAnomalies && (
                <>
                  <path
                    d={chartData.totalPath}
                    fill="none"
                    stroke="oklch(0.60 0.22 25)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path d={chartData.areaPath} fill="url(#anomalyGradient)" />

                  {chartData.focusPoint && (
                    <>
                      <circle
                        cx={chartData.focusPoint.x}
                        cy={chartData.focusPoint.y}
                        r="5"
                        fill="oklch(0.60 0.22 25)"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <circle
                        cx={chartData.focusPoint.x}
                        cy={chartData.focusPoint.y}
                        r="10"
                        fill="oklch(0.60 0.22 25)"
                        fillOpacity="0.25"
                      />
                    </>
                  )}
                </>
              )}

              {/* Baseline Focus Indicator */}
              {chartData.focusBaselinePoint && (
                <circle
                  cx={chartData.focusBaselinePoint.x}
                  cy={chartData.focusBaselinePoint.y}
                  r="4"
                  fill="oklch(0.58 0.22 260)"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              )}
            </svg>

            {/* X-axis Month Labels */}
            <div className="flex justify-between px-2 pt-1 text-[9px] font-mono text-muted-foreground/60 uppercase">
              {monthlyBuckets.map((b) => {
                const isFocused = focusBucket?.key === b.key
                return (
                  <span
                    key={b.key}
                    className={isFocused ? 'font-bold text-foreground' : undefined}
                  >
                    {b.monthName}
                  </span>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        /* Honest Empty-State Telemetry Placeholder */
        <div className="h-40 sm:h-52 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/40 rounded-xl bg-muted/5">
          <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-xs font-semibold text-foreground">
            {transactionCount === 0 ? 'No Telemetry Data' : 'Single-Period Ledger'}
          </p>
          <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
            {transactionCount === 0
              ? 'Import an invoice ledger to generate continuous risk telemetry curves.'
              : `Audited volume recorded for ${monthlyBuckets[0]?.monthName || 'current period'}. Trend curves will render as historical periods expand.`}
          </p>
        </div>
      )}
    </div>
  )
}
