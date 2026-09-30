'use client'

import { useMemo } from 'react'
import { RiskCase, Transaction } from '@/lib/api'
import { ChartData, MonthlyBucket, SvgPoint } from '../types'
import { formatCurrencyK, formatMonthYear, generateSplinePath } from '../lib/format'

export interface LedgerTelemetry {
  monthlyBuckets: MonthlyBucket[]
  focusBucket: MonthlyBucket | null
  chartData: ChartData | null
  datasetPeriodLabel: string
}

interface Options {
  transactions: Transaction[]
  benchmarkCase: RiskCase | null
  openFlaggedTxIds: Set<string>
}

/**
 * CHART TELEMETRY SPECIFICATION:
 * - X-Axis: Monthly chronological timeline derived dynamically from transaction invoice_date records.
 * - Y-Axis: Monthly aggregate transaction volume in USD across monitored accounts.
 * - Standard Volume Curve (Blue): Monthly aggregate of compliant, non-flagged transactions.
 * - Total / Risk Volume Curve (Red): Monthly aggregate including flagged anomalous transactions.
 *   Diverges upward from the baseline curve in periods with active anomalies. If zero anomalies
 *   exist, only the calm baseline curve is drawn.
 * - Pinned Tooltip: Displays aggregate monthly telemetry corresponding to the peak anomaly period
 *   (or latest active period when all transactions are verified within baseline).
 * - Per-Supplier Historical Baseline: Detailed mean and deviation multiplier metrics are displayed
 *   in the telemetry metric & badge section on the left, keeping ledger volume clearly distinguished.
 */
export function useLedgerTelemetry(options: Options): LedgerTelemetry {
  const { transactions, benchmarkCase, openFlaggedTxIds } = options

  // 1. Monthly aggregation
  const monthlyBuckets = useMemo<MonthlyBucket[]>(() => {
    if (transactions.length === 0) return []

    const map = new Map<
      string,
      { date: Date; total: number; anomalous: number; flaggedCount: number; hasBenchmark: boolean }
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
      return {
        key,
        monthName: data.date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        year: data.date.getUTCFullYear(),
        totalAmount: data.total,
        standardAmount: Math.max(0, data.total - data.anomalous),
        anomalousAmount: data.anomalous,
        hasAnomaly: data.anomalous > 0,
        flaggedTxCount: data.flaggedCount,
        benchmarkInMonth: data.hasBenchmark,
      }
    })
  }, [transactions, openFlaggedTxIds, benchmarkCase])

  // 2. Focused month for the pinned tooltip
  const focusBucket = useMemo<MonthlyBucket | null>(() => {
    if (monthlyBuckets.length === 0) return null
    const benchmarkBucket = monthlyBuckets.find((b) => b.benchmarkInMonth)
    if (benchmarkBucket) return benchmarkBucket
    const topAnomaly = [...monthlyBuckets].sort(
      (a, b) => b.anomalousAmount - a.anomalousAmount
    )[0]
    if (topAnomaly && topAnomaly.anomalousAmount > 0) return topAnomaly
    return monthlyBuckets[monthlyBuckets.length - 1]
  }, [monthlyBuckets])

  // 3. Pre-computed SVG geometry
  const chartData = useMemo<ChartData | null>(() => {
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

    const baselinePoints: SvgPoint[] = monthlyBuckets.map((b, i) => ({
      x: xStart + i * xStep,
      y: getY(b.standardAmount),
    }))
    const totalPoints: SvgPoint[] = monthlyBuckets.map((b, i) => ({
      x: xStart + i * xStep,
      y: getY(b.totalAmount),
    }))

    const baselinePath = generateSplinePath(baselinePoints)
    const totalPath = generateSplinePath(totalPoints)
    const areaPath =
      totalPoints.length > 0
        ? `${totalPath} L ${totalPoints[totalPoints.length - 1].x.toFixed(1)},185 L ${totalPoints[0].x.toFixed(1)},185 Z`
        : ''

    const focusIndex = focusBucket
      ? monthlyBuckets.findIndex((b) => b.key === focusBucket.key)
      : -1

    return {
      baselinePath,
      totalPath,
      areaPath,
      hasAnomalies: monthlyBuckets.some((b) => b.hasAnomaly),
      focusPoint: focusIndex >= 0 ? totalPoints[focusIndex] : null,
      focusBaselinePoint: focusIndex >= 0 ? baselinePoints[focusIndex] : null,
      focusIndex,
      yTicks: [
        { y: 30, label: formatCurrencyK(yCeil) },
        { y: 75, label: formatCurrencyK(yCeil * 0.67) },
        { y: 120, label: formatCurrencyK(yCeil * 0.33) },
        { y: 165, label: '$0' },
      ],
    }
  }, [monthlyBuckets, focusBucket])

  // 4. Dataset cycle period label
  const datasetPeriodLabel = useMemo(() => {
    if (focusBucket) return `${focusBucket.monthName} ${focusBucket.year}`
    if (transactions.length > 0 && transactions[0].invoice_date) {
      return formatMonthYear(transactions[0].invoice_date)
    }
    return 'Current Cycle'
  }, [focusBucket, transactions])

  return { monthlyBuckets, focusBucket, chartData, datasetPeriodLabel }
}
