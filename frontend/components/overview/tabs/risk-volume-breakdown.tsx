'use client'

import { Calendar, CheckCircle2, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { RiskCase, formatCurrency } from '@/lib/api'
import { ExposureBreakdown, VolumeBreakdown } from '../types'
import { formatCents, formatWhole } from '../lib/format'

interface RiskVolumeBreakdownProps {
  exposure: ExposureBreakdown
  volume: VolumeBreakdown
  benchmarkCase: RiskCase | null
  datasetPeriodLabel: string
  ruleCount: number
}

/**
 * Second dashboard card: side-by-side anomalous vs. verified standard volume,
 * each with a segmented progress bar proportional to case severity.
 */
export function RiskVolumeBreakdown({
  exposure,
  volume,
  benchmarkCase,
  datasetPeriodLabel,
  ruleCount,
}: RiskVolumeBreakdownProps) {
  const topSignalName =
    benchmarkCase?.trigger_signals?.[0]?.rule_name ||
    (exposure.high > 0 ? 'Critical Deviation' : 'Flagged Rule Policy')

  const Segment = ({
    ratio,
    className,
    title,
  }: {
    ratio: number
    className: string
    title: string
  }) => (
    <div
      style={{ width: `${ratio.toFixed(1)}%` }}
      className={`h-full ${className}`}
      title={title}
    />
  )

  return (
    <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f]">
      <div className="flex items-center justify-between pb-5">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
          Risk Movement &amp; Volume Breakdown
        </h2>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/30 text-xs font-medium text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{datasetPeriodLabel}</span>
        </div>
      </div>

      {/* 2 Side-by-Side Subcards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Subcard 1: Anomalous Volume */}
        <div className="rounded-2xl bg-muted/20 dark:bg-muted/10 p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Anomalous Volume</span>
            <div className="w-7 h-7 rounded-lg bg-card dark:bg-[#20232b] flex items-center justify-center text-muted-foreground shadow-xs">
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {formatWhole(volume.anomalous)}
            </span>
            <span className="text-sm font-mono text-muted-foreground/60">
              {formatCents(volume.anomalous)}
            </span>
          </div>

          {/* Segmented Progress Bar: Proportions by case severity */}
          <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex gap-0.5">
            {volume.anomalous > 0 ? (
              <>
                {exposure.high > 0 && (
                  <Segment
                    ratio={(exposure.high / volume.anomalous) * 100}
                    className="bg-destructive rounded-l-full"
                    title={`Critical Exposure: ${formatCurrency(exposure.high)}`}
                  />
                )}
                {exposure.medium > 0 && (
                  <Segment
                    ratio={(exposure.medium / volume.anomalous) * 100}
                    className="bg-warning"
                    title={`Moderate Exposure: ${formatCurrency(exposure.medium)}`}
                  />
                )}
                {exposure.low > 0 && (
                  <Segment
                    ratio={(exposure.low / volume.anomalous) * 100}
                    className="bg-primary rounded-r-full"
                    title={`Low Exposure: ${formatCurrency(exposure.low)}`}
                  />
                )}
              </>
            ) : (
              <div className="h-full bg-muted/30 w-full" />
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
            {volume.anomalous > 0 ? (
              <>
                The highest risk signal this cycle is from{' '}
                <strong className="text-destructive font-semibold">{topSignalName}</strong>
                {exposure.medium > 0 && exposure.high > 0 && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Includes {formatCurrency(exposure.high)} critical and{' '}
                    {formatCurrency(exposure.medium)} moderate findings.
                  </span>
                )}
              </>
            ) : (
              'Zero anomalous volume detected across all audited supplier accounts.'
            )}
          </p>
        </div>

        {/* Subcard 2: Standard Audited Volume */}
        <div className="rounded-2xl bg-muted/20 dark:bg-muted/10 p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Verified Standard Volume
            </span>
            <div className="w-7 h-7 rounded-lg bg-card dark:bg-[#20232b] flex items-center justify-center text-success shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {formatWhole(volume.verifiedStandard)}
            </span>
            <span className="text-sm font-mono text-muted-foreground/60">
              {formatCents(volume.verifiedStandard)}
            </span>
          </div>

          {/* Segmented Progress Bar: Compliant vs Flagged */}
          <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex gap-0.5">
            {volume.totalTxCount > 0 ? (
              <>
                <div
                  style={{ width: `${volume.compliantPercentage.toFixed(1)}%` }}
                  className={`h-full bg-success ${
                    volume.flaggedTxCount === 0 ? 'rounded-full' : 'rounded-l-full'
                  }`}
                  title={`${volume.compliantTxCount} Compliant Invoices`}
                />
                {volume.flaggedTxCount > 0 && (
                  <div
                    style={{ width: `${volume.flaggedPercentage.toFixed(1)}%` }}
                    className="h-full bg-destructive/60 rounded-r-full"
                    title={`${volume.flaggedTxCount} Flagged Outlier${
                      volume.flaggedTxCount === 1 ? '' : 's'
                    }`}
                  />
                )}
              </>
            ) : (
              <div className="h-full bg-muted/30 w-full" />
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
            {volume.totalTxCount > 0 ? (
              <>
                Over{' '}
                <strong>{volume.compliantPercentage.toFixed(1)}%</strong> of audited
                transactions cleared all{' '}
                <strong className="text-success font-semibold">
                  {ruleCount || 6} deterministic rules
                </strong>
              </>
            ) : (
              'No audited volume yet — import a dataset to begin monitoring.'
            )}
          </p>
        </div>
      </div>
    </Card>
  )
}
