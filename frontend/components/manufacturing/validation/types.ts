export type RunStatus = 'completed' | 'incomplete'

export interface RunConfig {
  horizons_days: number[]
  cutoff_step_months: number
  event_threshold_pct: number
  alert_threshold: number
  flat_band_pct: number
  dataset_id: string | null
  material_ids: string[]
  cutoffs: string[]
  last_complete_month: string
}

export interface RunFailure {
  error_type: string
  message: string
  recorded_at: string
}

export interface RunListItem {
  run_id: string
  status: RunStatus
  created_at: string
  created_by: string
  dataset_id: string | null
  data_end: string
  note: string | null
  config: RunConfig
  versions: Record<string, string | number>
  completed_at: string | null
  failure: RunFailure | null
  cases: number | null
  evaluated: number | null
}

export interface ForecastMetrics {
  n: number
  mae?: number
  rmse?: number
  mape_pct?: number | null
  mape_n?: number
  directional_accuracy?: number | null
  directional_n?: number
  directional_no_call_n?: number
  naive_mae?: number
  mae_vs_naive_pct?: number | null
  beats_naive_share?: number
  ties_naive_share?: number
  worse_than_naive_share?: number
  ties_naive?: number
}

export interface WarningMetrics {
  n: number
  events: number
  event_rate: number | null
  alerts: number
  tp: number
  fp: number
  fn: number
  tn: number
  precision: number | null
  recall: number | null
  false_positive_rate: number | null
  false_negative_rate: number | null
  unscored?: number
  unscored_events?: number
}

export interface LeadTime {
  n: number
  mean_months?: number
  median_months?: number
  min_months?: number
  max_months?: number
}

export interface MaterialMetrics extends ForecastMetrics {
  material_id: string
  events: number
}

export interface HorizonMetrics {
  cases: number
  withheld: number
  not_evaluable: number
  evaluated: number
  forecast: ForecastMetrics
  warning: WarningMetrics
  lead_time: LeadTime
  by_material: MaterialMetrics[]
  models: Record<string, number>
}

export interface ProblemCase {
  case_id: string
  material_id: string
  cutoff: string
  horizon_days: number
  risk_score: number | null
  forecast_change_pct: number
  actual_change_pct: number
}

export interface RunDetail extends RunListItem {
  metrics: { by_horizon: Record<string, HorizonMetrics>; cases: number; frozen: number; evaluated: number } | null
  limitations: string[]
  problems: {
    not_forecast_or_evaluated: Record<string, number>
    worse_than_naive_cases: number
    false_positives: ProblemCase[]
    false_negatives: ProblemCase[]
  } | null
}

export interface RunRequest {
  horizons_days: number[]
  cutoff_step_months: number
  event_threshold_pct: number
  alert_threshold: number | null
  note: string | null
}
