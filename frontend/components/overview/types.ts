import { RuleSignal } from '@/lib/api'

/** Segmented filter pills on the audited invoice ledger. */
export type OverviewFilter = 'all' | 'high_risk' | 'missing_approval' | 'over_50k'

/** A point on the 600x220 telemetry SVG viewBox. */
export interface SvgPoint {
  x: number
  y: number
}

/** One monthly aggregate bucket derived from transaction invoice dates. */
export interface MonthlyBucket {
  key: string
  monthName: string
  year: number
  totalAmount: number
  standardAmount: number
  anomalousAmount: number
  hasAnomaly: boolean
  flaggedTxCount: number
  benchmarkInMonth: boolean
}

/** Pre-computed SVG geometry for the ledger telemetry spline chart. */
export interface ChartData {
  baselinePath: string
  totalPath: string
  areaPath: string
  hasAnomalies: boolean
  focusPoint: SvgPoint | null
  focusBaselinePoint: SvgPoint | null
  focusIndex: number
  yTicks: { y: number; label: string }[]
}

/** Disaggregated open exposure by case severity, in USD. */
export interface ExposureBreakdown {
  high: number
  medium: number
  low: number
  total: number
}

/** Volume mix across the whole audited ledger. */
export interface VolumeBreakdown {
  ledgerTotal: number
  anomalous: number
  verifiedStandard: number
  totalTxCount: number
  flaggedTxCount: number
  compliantTxCount: number
  compliantPercentage: number
  flaggedPercentage: number
}

/** Rule signals attached to the benchmark case, keyed by the rules the UI narrates. */
export interface BenchmarkSignals {
  r001?: RuleSignal
  r002?: RuleSignal
  r003?: RuleSignal
  r004?: RuleSignal
  r005?: RuleSignal
}
