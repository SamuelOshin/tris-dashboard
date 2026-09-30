'use client'

import { useMemo } from 'react'
import { BaselineStats, RiskCase, Supplier, Transaction, formatCurrency } from '@/lib/api'
import { BenchmarkSignals } from '../types'

export interface BenchmarkNarrative {
  signals: BenchmarkSignals
  supplierName: string
  targetAmount: number
  /** Per-supplier historical mean, preferring the live baseline over the stored signal. */
  effectiveBaselineMean: number
  /** Amount / baseline mean, or the ratio recorded by the rule engine. */
  deviationRatio: number | null
  secondaryBadge: string | null
  narrative: string
}

interface Options {
  benchmarkCase: RiskCase | null
  suppliers: Supplier[]
  baselineStats: BaselineStats | null
  openCases: RiskCase[]
  closedCases: RiskCase[]
  transactions: Transaction[]
  totalOpenExposure: number
  resolvedExposure: number
  txMap: Map<string, Transaction>
}

/**
 * Builds the hero narrative and deviation metrics for the benchmark case.
 *
 * Every claim is attributed to the rule signal that produced it — no claim is
 * asserted without a corresponding deterministic input.
 */
export function useBenchmarkNarrative(options: Options): BenchmarkNarrative {
  const {
    benchmarkCase,
    suppliers,
    baselineStats,
    openCases,
    closedCases,
    transactions,
    totalOpenExposure,
    resolvedExposure,
    txMap,
  } = options

  const targetTx = benchmarkCase ? txMap.get(benchmarkCase.transaction_id) : null
  const targetSupplier = benchmarkCase
    ? suppliers.find((s) => s.supplier_id === benchmarkCase.supplier_id)
    : null
  const supplierName = targetSupplier?.name || benchmarkCase?.supplier_id || 'Monitored Supplier'

  const signals: BenchmarkSignals = useMemo(
    () => ({
      r001: benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-001'),
      r002: benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-002'),
      r003: benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-003'),
      r004: benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-004'),
      r005: benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-005'),
    }),
    [benchmarkCase]
  )

  const { r001, r002, r003, r004, r005 } = signals

  // Prefer the live baseline endpoint; fall back to the mean recorded by the rule
  // engine in its evaluation snapshot, then to zero (no claim is made).
  const effectiveBaselineMean =
    baselineStats?.mean_amount ??
    (typeof r001?.diagnostics?.baseline_mean === 'number' ? r001.diagnostics.baseline_mean : 0)

  const targetAmount = targetTx?.amount || 0

  const deviationRatio = useMemo(() => {
    if (effectiveBaselineMean > 0 && targetTx?.amount) {
      return Number((targetTx.amount / effectiveBaselineMean).toFixed(2))
    }
    if (typeof r001?.diagnostics?.calculated_ratio === 'number') {
      return r001.diagnostics.calculated_ratio
    }
    return null
  }, [effectiveBaselineMean, targetTx?.amount, r001])

  // Secondary badge text derived from benchmark case signals
  const secondaryBadge = useMemo(() => {
    if (r002) {
      const days = r002.diagnostics?.delta_days
      return typeof days === 'number' ? `${days}-Day Bank Delta` : 'Recent Bank Delta'
    }
    if (r003) return 'Missing Approval'
    if (r004) return 'Off-Hours Access'
    if (r005) return 'Duplicate Invoice'
    return null
  }, [r002, r003, r004, r005])

  // Narrative generation with explicit attribution
  const narrative = useMemo(() => {
    if (totalOpenExposure === 0) {
      if (closedCases.length > 0) {
        return `All previous risk cases have been verified and resolved. A total of ${formatCurrency(
          resolvedExposure
        )} across ${closedCases.length} case${
          closedCases.length === 1 ? '' : 's'
        } has been secured through verified controls. Continuous surveillance active.`
      }
      if (transactions.length > 0) {
        return `All ${transactions.length} audited invoices across active supplier accounts are currently within baseline parameters. Automated rules surveillance active — zero active anomalies detected.`
      }
      return 'No active risk exposure. Ingest an invoice ledger or supplier dataset to initiate continuous automated baseline monitoring.'
    }

    if (!benchmarkCase) {
      return `Total flagged exposure of ${formatCurrency(
        totalOpenExposure
      )} detected across active surveillance pipeline. Automated rules recommend human review.`
    }

    const secondaryReasons: string[] = []
    if (r002) secondaryReasons.push('recent routing updates')
    if (r004) secondaryReasons.push('off-hours access')
    if (r003) secondaryReasons.push('missing approval gates')
    const secondaryStr =
      secondaryReasons.length > 0 ? `, accompanied by ${secondaryReasons.join(' and ')}` : ''

    let baseStory: string
    if (r001 && effectiveBaselineMean > 0 && deviationRatio) {
      baseStory = `With ${supplierName} invoice ${benchmarkCase.transaction_id} exceeding historical baseline (${formatCurrency(
        effectiveBaselineMean
      )}) by ${deviationRatio.toFixed(2)}x${secondaryStr}, automated rules recommend immediate human investigator review.`
    } else if (r005) {
      baseStory = `With ${supplierName} invoice ${benchmarkCase.transaction_id} (${formatCurrency(
        targetAmount
      )}) flagged as a duplicate submission, automated rules recommend immediate human investigator review.`
    } else {
      baseStory = `With ${supplierName} invoice ${benchmarkCase.transaction_id} (${formatCurrency(
        targetAmount
      )}) flagged under ${benchmarkCase.priority} priority review, automated controls recommend investigator assessment.`
    }

    // Explicit attribution for additional cases
    const otherOpenCases = openCases.filter((c) => c.case_id !== benchmarkCase.case_id)
    if (otherOpenCases.length > 0) {
      const otherExposure = otherOpenCases.reduce((acc, c) => {
        const amt = txMap.get(c.transaction_id)?.amount || 0
        return acc + amt
      }, 0)
      const otherTypes = Array.from(
        new Set(
          otherOpenCases.map((c) =>
            c.priority === 'High' ? 'critical anomaly' : 'moderate finding'
          )
        )
      ).join(', ')
      baseStory += ` Additionally, ${otherOpenCases.length} other case${
        otherOpenCases.length === 1 ? '' : 's'
      } (${otherTypes}) account for ${formatCurrency(otherExposure)} in pending review.`
    }

    return baseStory
  }, [
    totalOpenExposure,
    closedCases.length,
    resolvedExposure,
    transactions.length,
    benchmarkCase,
    r001,
    r002,
    r003,
    r004,
    r005,
    effectiveBaselineMean,
    deviationRatio,
    supplierName,
    targetAmount,
    openCases,
    txMap,
  ])

  return {
    signals,
    supplierName,
    targetAmount,
    effectiveBaselineMean,
    deviationRatio,
    secondaryBadge,
    narrative,
  }
}
