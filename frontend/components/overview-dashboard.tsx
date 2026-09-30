'use client'

import { Card } from '@/components/ui/card'
import { ErrorCard } from '@/components/ui/error-card'
import { useOverviewData } from '@/components/overview/hooks/use-overview-data'
import { useOverviewMetrics } from '@/components/overview/hooks/use-overview-metrics'
import { useBenchmarkNarrative } from '@/components/overview/hooks/use-benchmark-narrative'
import { useLedgerTelemetry } from '@/components/overview/hooks/use-ledger-telemetry'
import { HeroTelemetryCard } from '@/components/overview/tabs/hero-telemetry-card'
import { RiskVolumeBreakdown } from '@/components/overview/tabs/risk-volume-breakdown'
import { InvoiceLedgerTable } from '@/components/overview/tabs/invoice-ledger-table'

/**
 * Overview dashboard conductor.
 *
 * All data fetching and derivation lives in the hooks under `components/overview/hooks/`;
 * all presentation lives in `components/overview/tabs/`. This component only wires
 * the two together, so no card owns state that another card depends on.
 */
export function OverviewDashboard() {
  const data = useOverviewData()

  const metrics = useOverviewMetrics({
    transactions: data.transactions,
    openCases: data.openCases,
    closedCases: data.closedCases,
    highPriorityOpenCases: data.highPriorityOpenCases,
    mediumPriorityOpenCases: data.mediumPriorityOpenCases,
    lowPriorityOpenCases: data.lowPriorityOpenCases,
    txMap: data.txMap,
  })

  const narrative = useBenchmarkNarrative({
    benchmarkCase: data.benchmarkCase,
    suppliers: data.suppliers,
    baselineStats: data.baselineStats,
    openCases: data.openCases,
    closedCases: data.closedCases,
    transactions: data.transactions,
    totalOpenExposure: metrics.exposure.total,
    resolvedExposure: metrics.resolvedExposure,
    txMap: data.txMap,
  })

  const telemetry = useLedgerTelemetry({
    transactions: data.transactions,
    benchmarkCase: data.benchmarkCase,
    openFlaggedTxIds: metrics.openFlaggedTxIds,
  })

  if (data.loading) {
    return <OverviewSkeleton />
  }

  return (
    <div className="space-y-6">
      {data.ingestError && (
        <ErrorCard
          title="Some Dashboard Data Could Not Be Loaded"
          message={data.ingestError}
          onRetry={data.refetchIngest}
        />
      )}

      <HeroTelemetryCard
        summary={{
          exposure: metrics.exposure,
          resolvedExposure: metrics.resolvedExposure,
          closedCaseCount: data.closedCases.length,
          confirmedFraudCount: metrics.confirmedFraudClosures.length,
          benchmarkCase: data.benchmarkCase,
          baselineLoading: data.baselineLoading,
          effectiveBaselineMean: narrative.effectiveBaselineMean,
          deviationRatio: narrative.deviationRatio,
          secondaryBadge: narrative.secondaryBadge,
          narrative: narrative.narrative,
        }}
        chart={{
          chartData: telemetry.chartData,
          monthlyBuckets: telemetry.monthlyBuckets,
          focusBucket: telemetry.focusBucket,
          benchmarkCase: data.benchmarkCase,
          transactionCount: data.transactions.length,
        }}
      />

      <RiskVolumeBreakdown
        exposure={metrics.exposure}
        volume={metrics.volume}
        benchmarkCase={data.benchmarkCase}
        datasetPeriodLabel={telemetry.datasetPeriodLabel}
        ruleCount={data.rules.length}
      />

      <InvoiceLedgerTable
        transactions={data.transactions}
        caseByTxMap={data.caseByTxMap}
      />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="h-5 bg-muted/40 rounded-lg w-1/3 animate-pulse" />
        <div className="h-40 bg-muted/20 rounded-xl animate-pulse" />
      </Card>
      <Card className="p-6 space-y-4 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="h-5 bg-muted/40 rounded-lg w-1/4 animate-pulse" />
        <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
      </Card>
    </div>
  )
}
