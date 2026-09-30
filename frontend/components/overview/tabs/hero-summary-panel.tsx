'use client'

import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RiskCase, formatCurrency } from '@/lib/api'
import { ExposureBreakdown } from '../types'
import { formatCents, formatCurrencyK, formatWhole } from '../lib/format'

export interface HeroSummaryData {
  exposure: ExposureBreakdown
  resolvedExposure: number
  closedCaseCount: number
  confirmedFraudCount: number
  benchmarkCase: RiskCase | null
  baselineLoading: boolean
  effectiveBaselineMean: number
  deviationRatio: number | null
  secondaryBadge: string | null
  narrative: string
}

/**
 * Left column of the hero card: exposure headline, severity mix, resolved risk,
 * deviation badges, the attributed narrative, and the primary call to action.
 */
export function HeroSummaryPanel({
  exposure,
  resolvedExposure,
  closedCaseCount,
  confirmedFraudCount,
  benchmarkCase,
  baselineLoading,
  effectiveBaselineMean,
  deviationRatio,
  secondaryBadge,
  narrative,
}: HeroSummaryData) {
  const hasExposure = exposure.total > 0
  const showDeviationBadges = hasExposure && benchmarkCase !== null

  return (
    <div className="lg:col-span-5 space-y-4">
      <div>
        <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
          Total Incident Exposure
        </p>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono">
            {formatWhole(exposure.total)}
          </span>
          <span className="text-lg font-bold text-muted-foreground/50 font-mono">
            {formatCents(exposure.total)}
          </span>
        </div>
      </div>

      {/* Severity Breakdown Badges when active exposure exists */}
      {hasExposure ? (
        <div className="flex flex-wrap items-center gap-2">
          {exposure.high > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-destructive/10 text-destructive border-0">
              Critical: {formatCurrency(exposure.high)}
            </span>
          )}
          {exposure.medium > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-warning/10 text-warning border-0">
              Moderate: {formatCurrency(exposure.medium)}
            </span>
          )}
          {exposure.low > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-muted/40 text-muted-foreground border-0">
              Low: {formatCurrency(exposure.low)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-success/10 text-success border-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            All Clear · Zero Active Anomaly Exposure
          </span>
        </div>
      )}

      {/* Resolved Risk Secondary Display */}
      {closedCaseCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" />
          <span>
            Resolved Risk:{' '}
            <strong className="text-foreground font-mono">
              {formatCurrency(resolvedExposure)}
            </strong>{' '}
            across {closedCaseCount} case{closedCaseCount === 1 ? '' : 's'}
            {confirmedFraudCount > 0 && (
              <span className="text-[10px] text-muted-foreground ml-1">
                ({confirmedFraudCount} blocked)
              </span>
            )}
          </span>
        </div>
      )}

      {/* Signal-Driven Badges for Benchmark Finding */}
      {showDeviationBadges && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {baselineLoading ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-muted/30 text-muted-foreground animate-pulse">
              Computing Baseline...
            </span>
          ) : deviationRatio && deviationRatio > 1 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-destructive/10 text-destructive border-0">
              <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
              +{deviationRatio.toFixed(2)}x vs Baseline (
              {formatCurrencyK(effectiveBaselineMean)})
            </span>
          ) : null}

          {secondaryBadge && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-warning/10 text-warning border-0">
              <ArrowDownRight className="w-3.5 h-3.5 text-warning" />
              {secondaryBadge}
            </span>
          )}
        </div>
      )}

      {/* Narrative Intelligence Copy */}
      <p className="text-xs text-muted-foreground leading-relaxed">{narrative}</p>

      {/* Action CTA Button */}
      {benchmarkCase && hasExposure ? (
        <div className="pt-1">
          <Link href={`/cases/${benchmarkCase.case_id}`}>
            <Button
              size="sm"
              className="h-9 px-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-xs flex items-center gap-2 shadow-sm transition-transform active:scale-95"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
              Investigate Case {benchmarkCase.case_id}
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="pt-1">
          <Link href="/fraud-detection">
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-4 rounded-xl text-xs font-medium flex items-center gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-success" />
              View All Transactions
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
