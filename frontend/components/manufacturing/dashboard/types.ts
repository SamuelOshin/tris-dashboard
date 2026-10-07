import type { RiskLevel } from '../risk-score/types'

export interface StoredForecast {
  run_id: string
  horizon_days: number
  value: number
  lower: number | null
  upper: number | null
  last_observed_price: number | null
  change_pct: number | null
  currency: string | null
  model: string
  model_version: string
  dataset_version: string
  forecast_month: string
  stored_at: string
}

export interface StoredExposure {
  horizon_days: number
  currency: string | null
  projected_exposure: number
  exposure_pct: number | null
  baseline_spend: number
  forecast_spend: number
  stale_note: string | null
}

export interface OpenCase {
  case_id: string
  case_number: string
}

/** What is stored for one material: its newest score, forecasts, exposure and open case. */
export interface StoredResult {
  forecasts: Record<string, StoredForecast>
  exposure: StoredExposure | null
  score: {
    score_id: string
    score: number
    level: RiskLevel
    weight_version: number
    stored_at: string
  } | null
  open_case: OpenCase | null
}

export interface StoredResults {
  has_data: boolean
  as_of: string | null
  materials: Record<string, StoredResult>
}

export interface TrendPoint {
  as_of: string
  weight_version: number
  scored: number
  high_or_critical: number
  stored_at: string
}

export interface TopExposureRow {
  material_id: string
  description: string
  currency: string | null
  projected_exposure: number
  exposure_pct: number | null
  change_pct_30d: number | null
  level: RiskLevel | null
  open_case: OpenCase | null
}

export interface ManufacturingSummary {
  has_data: boolean
  as_of: string | null
  computed_at?: string
  materials_total?: number
  high_risk?: {
    count: number
    scored: number
    materials: { material_id: string; description: string; score: number; level: RiskLevel }[]
    reason_empty: string | null
  }
  projected_exposure?: {
    horizon_days: number
    by_currency: Record<string, number>
    materials_counted: number
    reason_empty: string | null
  }
  forecast_increase_30d?: { count: number; forecasted: number; reason_empty: string | null }
  supplier_concentration?: {
    count: number
    spend_window_days: number | null
    spend_by_currency: Record<string, number>
  }
  risk_trend?: TrendPoint[]
  top_exposure?: TopExposureRow[]
}
