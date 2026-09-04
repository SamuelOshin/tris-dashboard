'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  api,
  Transaction,
  RiskCase,
  Supplier,
  RuleConfig,
  BaselineStats,
  formatCurrency,
} from '@/lib/api'
import {
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MoreHorizontal,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { ErrorCard } from '@/components/ui/error-card'

/**
 * Currency and date formatting utility helpers
 */
function formatWhole(amount: number): string {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount || 0)
  return parts
    .filter((p) => p.type !== 'decimal' && p.type !== 'fraction')
    .map((p) => p.value)
    .join('')
}

function formatCents(amount: number): string {
  const cents = Math.round((Math.abs(amount || 0) % 1) * 100)
  return `.${String(cents).padStart(2, '0')}`
}

function formatCurrencyK(amount: number): string {
  if (!amount || amount === 0) return '$0'
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return formatCurrency(amount)
}

function formatMonthYear(dateStr?: string): string {
  if (!dateStr) return 'Current Cycle'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Current Cycle'
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  } catch {
    return 'Current Cycle'
  }
}

/**
 * Mathematically converts an array of 2D points into a smooth Catmull-Rom cubic Bezier SVG path string.
 */
function generateSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export function OverviewDashboard() {
  const [cases, setCases] = useState<RiskCase[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'high_risk' | 'missing_approval' | 'over_50k'>('all')

  // Sequenced baseline state for the benchmark case
  const [baselineLoading, setBaselineLoading] = useState(false)
  const [baselineStats, setBaselineStats] = useState<BaselineStats | null>(null)
  const [baselineError, setBaselineError] = useState<string | null>(null)

  // 1. Initial parallel data ingestion
  const refetchIngest = async () => {
    setLoading(true)
    setIngestError(null)
    const results = await Promise.allSettled([
      api.getCases(),
      api.getTransactions(undefined, 0, 1000),
      api.getSuppliers(),
      api.getRules(),
    ])
    const [casesRes, txsRes, suppliersRes, rulesRes] = results
    setCases(casesRes.status === 'fulfilled' ? casesRes.value : [])
    setTransactions(txsRes.status === 'fulfilled' ? txsRes.value : [])
    setSuppliers(suppliersRes.status === 'fulfilled' ? suppliersRes.value : [])
    setRules(rulesRes.status === 'fulfilled' ? rulesRes.value : [])

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : 'Unable to load data'))
    setIngestError(
      failed.length > 0
        ? `${failed.length} of ${results.length} data sources failed to load`
        : null,
    )
    setLoading(false)
  }

  useEffect(() => {
    void refetchIngest()
    return () => {}
  }, [])

  // 2. Lookup index maps for fast O(1) correlation
  const txMap = useMemo(
    () => new Map(transactions.map((t) => [t.transaction_id, t])),
    [transactions]
  )
  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.supplier_id, s])),
    [suppliers]
  )
  const caseByTxMap = useMemo(
    () => new Map(cases.map((c) => [c.transaction_id, c])),
    [cases]
  )

  // 3. Case categorization: Open vs. Closed
  const openCases = useMemo(
    () => cases.filter((c) => c.status !== 'Closed'),
    [cases]
  )
  const closedCases = useMemo(
    () => cases.filter((c) => c.status === 'Closed'),
    [cases]
  )

  const highPriorityOpenCases = useMemo(
    () => openCases.filter((c) => c.priority?.toLowerCase() === 'high'),
    [openCases]
  )
  const mediumPriorityOpenCases = useMemo(
    () => openCases.filter((c) => c.priority?.toLowerCase() === 'medium'),
    [openCases]
  )
  const lowPriorityOpenCases = useMemo(
    () => openCases.filter((c) => c.priority?.toLowerCase() === 'low'),
    [openCases]
  )

  // 4. Select Benchmark Case (the primary case for hero narrative & baseline)
  const benchmarkCase = useMemo(() => {
    if (highPriorityOpenCases.length > 0) return highPriorityOpenCases[0]
    if (openCases.length > 0) return openCases[0]
    if (closedCases.length > 0) return closedCases[0]
    return null
  }, [highPriorityOpenCases, openCases, closedCases])

  // 5. Sequenced baseline fetch for the benchmark case
  useEffect(() => {
    if (!benchmarkCase || !benchmarkCase.supplier_id) {
      setBaselineStats(null)
      setBaselineLoading(false)
      setBaselineError(null)
      return
    }

    let mounted = true
    setBaselineLoading(true)
    setBaselineError(null)

    api.getSupplierBaseline(benchmarkCase.supplier_id, benchmarkCase.transaction_id)
      .then((stats) => {
        if (mounted) {
          setBaselineStats(stats)
        }
      })
      .catch((err: any) => {
        if (mounted) {
          setBaselineError(err?.message || 'Baseline unavailable')
          setBaselineStats(null)
        }
      })
      .finally(() => {
        if (mounted) {
          setBaselineLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [benchmarkCase?.case_id, benchmarkCase?.supplier_id, benchmarkCase?.transaction_id])

  // 6. Open Flagged Transactions and Exposure Calculations
  const openFlaggedTxIds = useMemo(
    () => new Set(openCases.map((c) => c.transaction_id).filter(Boolean)),
    [openCases]
  )

  // Disaggregated exposure by severity/rule type
  const highPriorityExposure = useMemo(() => {
    const txIds = new Set(highPriorityOpenCases.map((c) => c.transaction_id).filter(Boolean))
    let sum = 0
    txIds.forEach((id) => {
      sum += txMap.get(id)?.amount || 0
    })
    return sum
  }, [highPriorityOpenCases, txMap])

  const mediumPriorityExposure = useMemo(() => {
    const highTxIds = new Set(highPriorityOpenCases.map((c) => c.transaction_id).filter(Boolean))
    const txIds = new Set(
      mediumPriorityOpenCases
        .map((c) => c.transaction_id)
        .filter((id) => Boolean(id) && !highTxIds.has(id))
    )
    let sum = 0
    txIds.forEach((id) => {
      sum += txMap.get(id)?.amount || 0
    })
    return sum
  }, [mediumPriorityOpenCases, highPriorityOpenCases, txMap])

  const lowPriorityExposure = useMemo(() => {
    const higherTxIds = new Set(
      [...highPriorityOpenCases, ...mediumPriorityOpenCases]
        .map((c) => c.transaction_id)
        .filter(Boolean)
    )
    const txIds = new Set(
      lowPriorityOpenCases
        .map((c) => c.transaction_id)
        .filter((id) => Boolean(id) && !higherTxIds.has(id))
    )
    let sum = 0
    txIds.forEach((id) => {
      sum += txMap.get(id)?.amount || 0
    })
    return sum
  }, [lowPriorityOpenCases, highPriorityOpenCases, mediumPriorityOpenCases, txMap])

  const totalOpenExposure = highPriorityExposure + mediumPriorityExposure + lowPriorityExposure

  // Resolved risk calculation
  const closedCaseTxIds = useMemo(
    () => new Set(closedCases.map((c) => c.transaction_id).filter(Boolean)),
    [closedCases]
  )
  const resolvedExposure = useMemo(() => {
    let sum = 0
    closedCaseTxIds.forEach((id) => {
      sum += txMap.get(id)?.amount || 0
    })
    return sum
  }, [closedCaseTxIds, txMap])

  const confirmedFraudClosures = useMemo(
    () =>
      closedCases.filter(
        (c) =>
          c.closure_type?.toLowerCase().includes('fraud') ||
          c.closure_type?.toLowerCase().includes('block')
      ),
    [closedCases]
  )

  // 7. Overall Ledger Volume Breakdown
  const totalLedgerVolume = useMemo(
    () => transactions.reduce((acc, t) => acc + (t.amount || 0), 0),
    [transactions]
  )

  const totalAnomalousVolume = useMemo(() => {
    let sum = 0
    openFlaggedTxIds.forEach((id) => {
      sum += txMap.get(id)?.amount || 0
    })
    return sum
  }, [openFlaggedTxIds, txMap])

  const verifiedStandardVolume = Math.max(0, totalLedgerVolume - totalAnomalousVolume)
  const totalTxCount = transactions.length
  const flaggedTxCount = openFlaggedTxIds.size
  const compliantTxCount = Math.max(0, totalTxCount - flaggedTxCount)
  const compliantPercentage = totalTxCount > 0 ? (compliantTxCount / totalTxCount) * 100 : 100
  const flaggedPercentage = totalTxCount > 0 ? 100 - compliantPercentage : 0

  // 8. Benchmark Case Deviation & Narrative Diagnostics
  const targetTx = benchmarkCase ? txMap.get(benchmarkCase.transaction_id) : null
  const targetSupplier = benchmarkCase ? supplierMap.get(benchmarkCase.supplier_id) : null
  const supplierName = targetSupplier?.name || benchmarkCase?.supplier_id || 'Monitored Supplier'

  const r001Signal = benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-001')
  const r002Signal = benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-002')
  const r003Signal = benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-003')
  const r004Signal = benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-004')
  const r005Signal = benchmarkCase?.trigger_signals?.find((s) => s.rule_code === 'R-005')

  const effectiveBaselineMean =
    baselineStats?.mean_amount ??
    (typeof r001Signal?.diagnostics?.baseline_mean === 'number'
      ? r001Signal.diagnostics.baseline_mean
      : 0)

  const computedDeviationRatio = useMemo(() => {
    if (effectiveBaselineMean > 0 && targetTx?.amount) {
      return Number((targetTx.amount / effectiveBaselineMean).toFixed(2))
    }
    if (typeof r001Signal?.diagnostics?.calculated_ratio === 'number') {
      return r001Signal.diagnostics.calculated_ratio
    }
    return null
  }, [effectiveBaselineMean, targetTx?.amount, r001Signal])

  // Secondary badge text from benchmark case signals
  const secondaryBadge = useMemo(() => {
    if (r002Signal) {
      const days = r002Signal.diagnostics?.delta_days
      return typeof days === 'number' ? `${days}-Day Bank Delta` : 'Recent Bank Delta'
    }
    if (r003Signal) return 'Missing Approval'
    if (r004Signal) return 'Off-Hours Access'
    if (r005Signal) return 'Duplicate Invoice'
    return null
  }, [r002Signal, r003Signal, r004Signal, r005Signal])

  // Narrative generation with explicit attribution
  const narrativeCopy = useMemo(() => {
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
    if (r002Signal) secondaryReasons.push('recent routing updates')
    if (r004Signal) secondaryReasons.push('off-hours access')
    if (r003Signal) secondaryReasons.push('missing approval gates')
    const secondaryStr =
      secondaryReasons.length > 0 ? `, accompanied by ${secondaryReasons.join(' and ')}` : ''

    let baseStory = ''
    if (r001Signal && effectiveBaselineMean > 0 && computedDeviationRatio) {
      baseStory = `With ${supplierName} invoice ${benchmarkCase.transaction_id} exceeding historical baseline (${formatCurrency(
        effectiveBaselineMean
      )}) by ${computedDeviationRatio.toFixed(2)}x${secondaryStr}, automated rules recommend immediate human investigator review.`
    } else if (r005Signal) {
      baseStory = `With ${supplierName} invoice ${benchmarkCase.transaction_id} (${formatCurrency(
        targetTx?.amount || 0
      )}) flagged as a duplicate submission, automated rules recommend immediate human investigator review.`
    } else {
      baseStory = `With ${supplierName} invoice ${benchmarkCase.transaction_id} (${formatCurrency(
        targetTx?.amount || 0
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
    r001Signal,
    r002Signal,
    r003Signal,
    r004Signal,
    r005Signal,
    effectiveBaselineMean,
    computedDeviationRatio,
    supplierName,
    targetTx?.amount,
    openCases,
    txMap,
  ])

  // 9. Monthly Aggregation for Spline Ledger Telemetry Chart
  const monthlyBuckets = useMemo(() => {
    if (transactions.length === 0) return []

    const map = new Map<
      string,
      {
        date: Date
        total: number
        anomalous: number
        flaggedCount: number
        hasBenchmark: boolean
      }
    >()

    transactions.forEach((tx) => {
      if (!tx.invoice_date) return
      const key = tx.invoice_date.slice(0, 7)
      const entry = map.get(key) || {
        date: new Date(tx.invoice_date),
        total: 0,
        anomalous: 0,
        flaggedCount: 0,
        hasBenchmark: false,
      }
      const isAnomalous = openFlaggedTxIds.has(tx.transaction_id)
      entry.total += tx.amount
      if (isAnomalous) {
        entry.anomalous += tx.amount
        entry.flaggedCount += 1
      }
      if (benchmarkCase && benchmarkCase.transaction_id === tx.transaction_id) {
        entry.hasBenchmark = true
      }
      map.set(key, entry)
    })

    const sortedKeys = Array.from(map.keys()).sort()
    return sortedKeys.map((key) => {
      const data = map.get(key)!
      const monthName = data.date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
      const year = data.date.getUTCFullYear()
      const standard = Math.max(0, data.total - data.anomalous)
      return {
        key,
        monthName,
        year,
        totalAmount: data.total,
        standardAmount: standard,
        anomalousAmount: data.anomalous,
        hasAnomaly: data.anomalous > 0,
        flaggedTxCount: data.flaggedCount,
        benchmarkInMonth: data.hasBenchmark,
      }
    })
  }, [transactions, openFlaggedTxIds, benchmarkCase])

  // Focused month for tooltip telemetry
  const focusBucket = useMemo(() => {
    if (monthlyBuckets.length === 0) return null
    const benchmarkBucket = monthlyBuckets.find((b) => b.benchmarkInMonth)
    if (benchmarkBucket) return benchmarkBucket
    const topAnomaly = [...monthlyBuckets].sort((a, b) => b.anomalousAmount - a.anomalousAmount)[0]
    if (topAnomaly && topAnomaly.anomalousAmount > 0) return topAnomaly
    return monthlyBuckets[monthlyBuckets.length - 1]
  }, [monthlyBuckets])

  /**
   * CHART TELEMETRY SPECIFICATION:
   * - X-Axis: Monthly chronological timeline derived dynamically from transaction invoice_date records.
   * - Y-Axis: Monthly aggregate transaction volume in USD across monitored accounts.
   * - Standard Volume Curve (Blue): Monthly aggregate of compliant, non-flagged transactions.
   * - Total / Risk Volume Curve (Red): Monthly aggregate including flagged anomalous transactions.
   *   Diverges upward from the baseline curve in periods with active anomalies. If zero anomalies exist,
   *   only the calm baseline curve is drawn.
   * - Pinned Tooltip: Displays aggregate monthly telemetry corresponding to the peak anomaly period
   *   (or latest active period when all transactions are verified within baseline).
   * - Per-Supplier Historical Baseline: Detailed mean and deviation multiplier metrics are displayed
   *   in the telemetry metric & badge section on the left, keeping ledger volume clearly distinguished.
   */
  const chartData = useMemo(() => {
    if (monthlyBuckets.length < 2) return null

    const N = monthlyBuckets.length
    const maxVal = Math.max(
      ...monthlyBuckets.map((b) => Math.max(b.totalAmount, b.standardAmount)),
      1000
    )
    const yCeil = maxVal * 1.15

    const xStart = 25
    const xEnd = 575
    const xStep = (xEnd - xStart) / (N - 1)
    const yTop = 35
    const yBottom = 175
    const yRange = yBottom - yTop

    const getY = (val: number) => yBottom - (val / yCeil) * yRange

    const baselinePoints = monthlyBuckets.map((b, i) => ({
      x: xStart + i * xStep,
      y: getY(b.standardAmount),
    }))

    const totalPoints = monthlyBuckets.map((b, i) => ({
      x: xStart + i * xStep,
      y: getY(b.totalAmount),
    }))

    const baselinePath = generateSplinePath(baselinePoints)
    const totalPath = generateSplinePath(totalPoints)

    const areaPath =
      totalPoints.length > 0
        ? `${totalPath} L ${totalPoints[totalPoints.length - 1].x.toFixed(1)},185 L ${totalPoints[0].x.toFixed(1)},185 Z`
        : ''

    const hasAnomalies = monthlyBuckets.some((b) => b.hasAnomaly)
    const focusIndex = focusBucket ? monthlyBuckets.findIndex((b) => b.key === focusBucket.key) : -1
    const focusPoint = focusIndex >= 0 ? totalPoints[focusIndex] : null
    const focusBaselinePoint = focusIndex >= 0 ? baselinePoints[focusIndex] : null

    const yTicks = [
      { y: 30, label: formatCurrencyK(yCeil) },
      { y: 75, label: formatCurrencyK(yCeil * 0.67) },
      { y: 120, label: formatCurrencyK(yCeil * 0.33) },
      { y: 165, label: '$0' },
    ]

    return {
      baselinePath,
      totalPath,
      areaPath,
      hasAnomalies,
      focusPoint,
      focusBaselinePoint,
      focusIndex,
      yTicks,
    }
  }, [monthlyBuckets, focusBucket])

  // 10. Table Filtering
  const recentTransactions = useMemo(() => transactions.slice(0, 10), [transactions])

  const filteredTransactions = recentTransactions.filter((tx) => {
    const caseForTx = caseByTxMap.get(tx.transaction_id)
    if (activeFilter === 'high_risk') {
      return Boolean(caseForTx) || tx.amount >= 80000
    }
    if (activeFilter === 'missing_approval') return tx.approval_status === 'Missing'
    if (activeFilter === 'over_50k') return tx.amount >= 50000
    return true
  })

  // Dataset cycle period label
  const datasetPeriodLabel = useMemo(() => {
    if (focusBucket) return `${focusBucket.monthName} ${focusBucket.year}`
    if (transactions.length > 0 && transactions[0].invoice_date) {
      return formatMonthYear(transactions[0].invoice_date)
    }
    return 'Current Cycle'
  }, [focusBucket, transactions])

  if (loading) {
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

  return (
    <div className="space-y-6">
      {ingestError && (
        <ErrorCard
          title="Some Dashboard Data Could Not Be Loaded"
          message={ingestError}
          onRetry={refetchIngest}
        />
      )}
      {/* 1. OVERVIEW HERO CARD WITH TELEMETRY SPLINE CHART */}
      <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] transition-all">
        {/* Header with Title and Action button */}
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Risk & Variance Overview
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
          {/* Left Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                Total Incident Exposure
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono">
                  {formatWhole(totalOpenExposure)}
                </span>
                <span className="text-lg font-bold text-muted-foreground/50 font-mono">
                  {formatCents(totalOpenExposure)}
                </span>
              </div>
            </div>

            {/* Severity Breakdown Badges when active exposure exists */}
            {totalOpenExposure > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {highPriorityExposure > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-destructive/10 text-destructive border-0">
                    Critical: {formatCurrency(highPriorityExposure)}
                  </span>
                )}
                {mediumPriorityExposure > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-warning/10 text-warning border-0">
                    Moderate: {formatCurrency(mediumPriorityExposure)}
                  </span>
                )}
                {lowPriorityExposure > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-muted/40 text-muted-foreground border-0">
                    Low: {formatCurrency(lowPriorityExposure)}
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
            {closedCases.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" />
                <span>
                  Resolved Risk:{' '}
                  <strong className="text-foreground font-mono">
                    {formatCurrency(resolvedExposure)}
                  </strong>{' '}
                  across {closedCases.length} case{closedCases.length === 1 ? '' : 's'}
                  {confirmedFraudClosures.length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({confirmedFraudClosures.length} blocked)
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Signal-Driven Badges for Benchmark Finding */}
            {totalOpenExposure > 0 && benchmarkCase && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {baselineLoading ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-muted/30 text-muted-foreground animate-pulse">
                    Computing Baseline...
                  </span>
                ) : computedDeviationRatio && computedDeviationRatio > 1 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-destructive/10 text-destructive border-0">
                    <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
                    +{computedDeviationRatio.toFixed(2)}x vs Baseline (
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              {narrativeCopy}
            </p>

            {/* Action CTA Button */}
            {benchmarkCase && totalOpenExposure > 0 ? (
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

          {/* Right Column: Monthly Telemetry Spline Chart (7 Cols) */}
          <div className="lg:col-span-7 relative bg-muted/15 dark:bg-muted/10 rounded-2xl p-3.5 sm:p-5 overflow-hidden">
            {chartData && focusBucket ? (
              <>
                {/* Pinned Tooltip Card: Aligned with the plotted monthly aggregate values */}
                <div className="mb-3 sm:mb-0 sm:absolute sm:top-4 sm:right-4 sm:z-10 bg-card dark:bg-[#1d2027] p-3 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] border-0 text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-200 max-w-full">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span>
                      {focusBucket.monthName} {focusBucket.year}
                      {focusBucket.hasAnomaly && benchmarkCase ? ` · ${benchmarkCase.transaction_id}` : ' · All Cleared'}
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
                  {transactions.length === 0 ? 'No Telemetry Data' : 'Single-Period Ledger'}
                </p>
                <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                  {transactions.length === 0
                    ? 'Import an invoice ledger to generate continuous risk telemetry curves.'
                    : `Audited volume recorded for ${monthlyBuckets[0]?.monthName || 'current period'}. Trend curves will render as historical periods expand.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 2. RISK TELEMETRY & MOVEMENT BREAKDOWN */}
      <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f]">
        <div className="flex items-center justify-between pb-5">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Risk Movement & Volume Breakdown
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
                {formatWhole(totalAnomalousVolume)}
              </span>
              <span className="text-sm font-mono text-muted-foreground/60">
                {formatCents(totalAnomalousVolume)}
              </span>
            </div>

            {/* Segmented Progress Bar: Proportions by case severity */}
            <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex gap-0.5">
              {totalAnomalousVolume > 0 ? (
                <>
                  {highPriorityExposure > 0 && (
                    <div
                      style={{
                        width: `${((highPriorityExposure / totalAnomalousVolume) * 100).toFixed(1)}%`,
                      }}
                      className="h-full bg-destructive rounded-l-full"
                      title={`Critical Exposure: ${formatCurrency(highPriorityExposure)}`}
                    />
                  )}
                  {mediumPriorityExposure > 0 && (
                    <div
                      style={{
                        width: `${((mediumPriorityExposure / totalAnomalousVolume) * 100).toFixed(1)}%`,
                      }}
                      className="h-full bg-warning"
                      title={`Moderate Exposure: ${formatCurrency(mediumPriorityExposure)}`}
                    />
                  )}
                  {lowPriorityExposure > 0 && (
                    <div
                      style={{
                        width: `${((lowPriorityExposure / totalAnomalousVolume) * 100).toFixed(1)}%`,
                      }}
                      className="h-full bg-primary rounded-r-full"
                      title={`Low Exposure: ${formatCurrency(lowPriorityExposure)}`}
                    />
                  )}
                </>
              ) : (
                <div className="h-full bg-muted/30 w-full" />
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
              {totalAnomalousVolume > 0 ? (
                <>
                  The highest risk signal this cycle is from{' '}
                  <strong className="text-destructive font-semibold">
                    {benchmarkCase?.trigger_signals?.[0]?.rule_name ||
                      (highPriorityExposure > 0 ? 'Critical Deviation' : 'Flagged Rule Policy')}
                  </strong>
                  {mediumPriorityExposure > 0 && highPriorityExposure > 0 && (
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      Includes {formatCurrency(highPriorityExposure)} critical and{' '}
                      {formatCurrency(mediumPriorityExposure)} moderate findings.
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
                {formatWhole(verifiedStandardVolume)}
              </span>
              <span className="text-sm font-mono text-muted-foreground/60">
                {formatCents(verifiedStandardVolume)}
              </span>
            </div>

            {/* Segmented Progress Bar: Compliant vs Flagged */}
            <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex gap-0.5">
              {totalTxCount > 0 ? (
                <>
                  <div
                    style={{ width: `${compliantPercentage.toFixed(1)}%` }}
                    className={`h-full bg-success ${flaggedTxCount === 0 ? 'rounded-full' : 'rounded-l-full'}`}
                    title={`${compliantTxCount} Compliant Invoices`}
                  />
                  {flaggedTxCount > 0 && (
                    <div
                      style={{ width: `${flaggedPercentage.toFixed(1)}%` }}
                      className="h-full bg-destructive/60 rounded-r-full"
                      title={`${flaggedTxCount} Flagged Outlier${flaggedTxCount === 1 ? '' : 's'}`}
                    />
                  )}
                </>
              ) : (
                <div className="h-full bg-muted/30 w-full" />
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
              {totalTxCount > 0 ? (
                <>
                  Over <strong>{compliantPercentage.toFixed(1)}%</strong> of audited transactions cleared all{' '}
                  <strong className="text-success font-semibold">
                    {rules.length || 6} deterministic rules
                  </strong>
                </>
              ) : (
                'No audited volume yet — import a dataset to begin monitoring.'
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* 3. AUDITED INVOICES TRANSACTIONS CARD */}
      <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] space-y-5">
        {/* Header with Title and Segmented Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Audited Invoices
            </h2>
            <p className="text-xs text-muted-foreground">
              Continuous relational ledger monitored against deterministic baselines
            </p>
          </div>

          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setActiveFilter('high_risk')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'high_risk'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              High Risk
            </button>
            <button
              onClick={() => setActiveFilter('missing_approval')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'missing_approval'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              Missing Approval
            </button>
            <button
              onClick={() => setActiveFilter('over_50k')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'over_50k'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              Over $50k
            </button>
          </div>
        </div>

        {/* Clean, Borderless Ledger Table */}
        <div className="overflow-x-auto -mx-6 px-6 scrollbar-thin">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead className="text-muted-foreground/70 font-mono font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Invoice Ref</th>
                <th className="py-3 px-3">Supplier ID</th>
                <th className="py-3 px-3">Invoice Date</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Approval</th>
                <th className="py-3 px-3 text-right">Verification Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-mono">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans">
                    {transactions.length === 0
                      ? 'No audited invoices found. Import a transaction ledger to begin monitoring.'
                      : 'No invoices match the selected filter.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const caseForTx = caseByTxMap.get(tx.transaction_id)
                  const isOutlier =
                    Boolean(caseForTx) || tx.amount >= 80000 || tx.approval_status === 'Missing'

                  return (
                    <tr
                      key={tx.transaction_id}
                      className={`transition-colors rounded-xl ${
                        isOutlier
                          ? 'bg-destructive/5 hover:bg-destructive/10'
                          : 'hover:bg-muted/20'
                      }`}
                    >
                      <td className="py-3.5 px-3 font-semibold text-foreground">
                        {tx.invoice_number || tx.transaction_id}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground text-[11px]">
                          {tx.supplier_id}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-muted-foreground font-sans text-xs">
                        {tx.invoice_date}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-foreground">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3.5 px-3 font-sans">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-medium ${
                            tx.approval_status === 'Approved'
                              ? 'bg-success/10 text-success'
                              : tx.approval_status === 'Missing'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          {tx.approval_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-sans">
                        {isOutlier ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-destructive/15 text-destructive">
                            <AlertTriangle className="w-3 h-3" />
                            Flagged Anomaly
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-medium text-success">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <Link
                          href={caseForTx ? `/cases/${caseForTx.case_id}` : '/fraud-detection'}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                          title={caseForTx ? `Investigate Case ${caseForTx.case_id}` : 'View Ledger'}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
