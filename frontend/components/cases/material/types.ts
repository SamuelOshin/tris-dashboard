import type { FactorScore } from '@/components/manufacturing/risk-score/types'

export interface SnapshotForecast {
  run_id: string
  horizon_days: number
  model: string
  forecast_value: number
  last_observed_price: number | null
  change_pct: number | null
  currency: string | null
}

export interface SnapshotExposure {
  horizon_days: number
  currency: string | null
  projected_exposure: number
  baseline_spend: number
  forecast_spend: number
  expected_usage: number
}

export interface LinkedScore {
  score_id: string
  score: number
  level: string
  as_of: string
  linked_at: string
  linked_by: string
}

/** What the case was opened with: the stored score, its factors, forecast and exposure. */
export interface MaterialSnapshot {
  source: string
  score_id: string
  score: number
  level: string
  as_of: string
  weight_version: number
  method_version: string
  data_coverage_pct: number
  summary: string
  currency: string | null
  factors: FactorScore[]
  forecast: SnapshotForecast | null
  exposure: SnapshotExposure | null
  linked_scores: LinkedScore[]
}

export interface MaterialCaseContext {
  case_id: string
  material: {
    material_id: string
    description: string
    category: string | null
    unit_of_measure: string | null
  }
  opened_from: Omit<MaterialSnapshot, 'forecast' | 'exposure'>
  forecast: SnapshotForecast | null
  exposure: SnapshotExposure | null
  replay: { reproduced: boolean; recomputed_score: number; stored_score: number; note: string }
  current: {
    score_id: string
    score: number
    level: string
    as_of: string
    change: number
    created_at: string
  } | null
}

export interface PriorCase {
  case_id: string
  case_number: string
  status: string
  priority: string
  case_category?: string
  material_id?: string | null
  root_cause?: string | null
  closure_date?: string | null
  created_at?: string | null
}
