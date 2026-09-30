'use client'

import { MoreHorizontal } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { HeroSummaryData, HeroSummaryPanel } from './hero-summary-panel'
import { SplineLedgerChart, SplineLedgerChartData } from './spline-ledger-chart'

interface HeroTelemetryCardProps {
  summary: HeroSummaryData
  chart: SplineLedgerChartData
}

/**
 * Hero card shell: title row plus the 12-column split between the exposure
 * summary (left, 5 cols) and the monthly telemetry spline chart (right, 7 cols).
 */
export function HeroTelemetryCard({ summary, chart }: HeroTelemetryCardProps) {
  return (
    <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] transition-all">
      {/* Header with Title and Action button */}
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
          Risk &amp; Variance Overview
        </h2>
        <button
          title="More Options"
          className="w-8 h-8 rounded-full bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* 2-Column Split: Telemetry Numbers on Left, Spline Curves on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <HeroSummaryPanel {...summary} />
        <SplineLedgerChart {...chart} />
      </div>
    </Card>
  )
}
