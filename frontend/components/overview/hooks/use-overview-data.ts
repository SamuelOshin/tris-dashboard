'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  api,
  BaselineStats,
  RiskCase,
  RuleConfig,
  Supplier,
  Transaction,
} from '@/lib/api'

export interface OverviewData {
  cases: RiskCase[]
  transactions: Transaction[]
  suppliers: Supplier[]
  rules: RuleConfig[]
  loading: boolean
  ingestError: string | null
  refetchIngest: () => Promise<void>
  // Correlation indexes
  txMap: Map<string, Transaction>
  caseByTxMap: Map<string, RiskCase>
  // Categorization
  openCases: RiskCase[]
  closedCases: RiskCase[]
  highPriorityOpenCases: RiskCase[]
  mediumPriorityOpenCases: RiskCase[]
  lowPriorityOpenCases: RiskCase[]
  /** Primary case driving the hero narrative and the per-supplier baseline. */
  benchmarkCase: RiskCase | null
  // Sequenced baseline state for the benchmark case
  baselineLoading: boolean
  baselineStats: BaselineStats | null
  baselineError: string | null
}

/**
 * Owns all network orchestration and the lookup indexes for the overview dashboard.
 *
 * Every derived value here is a pure correlation of fetched records, so it is safe
 * to recompute on data change without any server round-trip.
 */
export function useOverviewData(): OverviewData {
  const [cases, setCases] = useState<RiskCase[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [ingestError, setIngestError] = useState<string | null>(null)

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

    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    )
    setIngestError(
      failed.length > 0
        ? `${failed.length} of ${results.length} data sources failed to load`
        : null
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
  const caseByTxMap = useMemo(
    () => new Map(cases.map((c) => [c.transaction_id, c])),
    [cases]
  )

  // 3. Case categorization: Open vs. Closed
  const openCases = useMemo(() => cases.filter((c) => c.status !== 'Closed'), [cases])
  const closedCases = useMemo(() => cases.filter((c) => c.status === 'Closed'), [cases])

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

  return {
    cases,
    transactions,
    suppliers,
    rules,
    loading,
    ingestError,
    refetchIngest,
    txMap,
    caseByTxMap,
    openCases,
    closedCases,
    highPriorityOpenCases,
    mediumPriorityOpenCases,
    lowPriorityOpenCases,
    benchmarkCase,
    baselineLoading,
    baselineStats,
    baselineError,
  }
}
