'use client'

import { useMemo } from 'react'
import { RiskCase, Transaction } from '@/lib/api'
import { ExposureBreakdown, VolumeBreakdown } from '../types'

export interface OverviewMetrics {
  exposure: ExposureBreakdown
  resolvedExposure: number
  confirmedFraudClosures: RiskCase[]
  volume: VolumeBreakdown
  /** transaction_id set for every transaction currently backing an open case. */
  openFlaggedTxIds: Set<string>
}

interface Options {
  transactions: Transaction[]
  openCases: RiskCase[]
  closedCases: RiskCase[]
  highPriorityOpenCases: RiskCase[]
  mediumPriorityOpenCases: RiskCase[]
  lowPriorityOpenCases: RiskCase[]
  txMap: Map<string, Transaction>
}

/**
 * Aggregates money at risk. Pure arithmetic over already-fetched records — no
 * network, no mutation.
 *
 * Exposure buckets are mutually exclusive: a transaction is attributed to the
 * highest severity case that references it, so the three severities sum to the
 * reported total without double counting.
 */
export function useOverviewMetrics(options: Options): OverviewMetrics {
  const {
    transactions,
    openCases,
    closedCases,
    highPriorityOpenCases,
    mediumPriorityOpenCases,
    lowPriorityOpenCases,
    txMap,
  } = options

  const openFlaggedTxIds = useMemo(
    () => new Set(openCases.map((c) => c.transaction_id).filter(Boolean)),
    [openCases]
  )

  const sumFor = (txIds: Set<string>) => {
    let sum = 0
    txIds.forEach((id) => {
      sum += txMap.get(id)?.amount || 0
    })
    return sum
  }

  const exposure: ExposureBreakdown = useMemo(() => {
    const highTxIds = new Set(
      highPriorityOpenCases.map((c) => c.transaction_id).filter(Boolean) as string[]
    )
    const mediumTxIds = new Set(
      mediumPriorityOpenCases
        .map((c) => c.transaction_id)
        .filter((id) => Boolean(id) && !highTxIds.has(id as string)) as string[]
    )
    const lowTxIds = new Set(
      lowPriorityOpenCases
        .map((c) => c.transaction_id)
        .filter((id) => Boolean(id) && !highTxIds.has(id as string) && !mediumTxIds.has(id as string)) as string[]
    )

    const high = sumFor(highTxIds)
    const medium = sumFor(mediumTxIds)
    const low = sumFor(lowTxIds)
    return { high, medium, low, total: high + medium + low }
    // sumFor is stable per render given txMap; the case lists are the real inputs.
  }, [highPriorityOpenCases, mediumPriorityOpenCases, lowPriorityOpenCases, txMap])

  const resolvedExposure = useMemo(() => {
    const closedCaseTxIds = new Set(
      closedCases.map((c) => c.transaction_id).filter(Boolean) as string[]
    )
    return sumFor(closedCaseTxIds)
  }, [closedCases, txMap])

  const confirmedFraudClosures = useMemo(
    () =>
      closedCases.filter(
        (c) =>
          c.closure_type?.toLowerCase().includes('fraud') ||
          c.closure_type?.toLowerCase().includes('block')
      ),
    [closedCases]
  )

  const volume: VolumeBreakdown = useMemo(() => {
    const ledgerTotal = transactions.reduce((acc, t) => acc + (t.amount || 0), 0)
    const anomalous = sumFor(openFlaggedTxIds)
    const totalTxCount = transactions.length
    const flaggedTxCount = openFlaggedTxIds.size
    const compliantTxCount = Math.max(0, totalTxCount - flaggedTxCount)
    const compliantPercentage = totalTxCount > 0 ? (compliantTxCount / totalTxCount) * 100 : 100

    return {
      ledgerTotal,
      anomalous,
      verifiedStandard: Math.max(0, ledgerTotal - anomalous),
      totalTxCount,
      flaggedTxCount,
      compliantTxCount,
      compliantPercentage,
      flaggedPercentage: totalTxCount > 0 ? 100 - compliantPercentage : 0,
    }
  }, [transactions, openFlaggedTxIds, txMap])

  return { exposure, resolvedExposure, confirmedFraudClosures, volume, openFlaggedTxIds }
}
