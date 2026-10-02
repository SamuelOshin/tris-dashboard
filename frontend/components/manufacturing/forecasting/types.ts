export type HorizonStatus = 'forecast' | 'withheld' | 'not_run'

export interface ForecastableMaterial {
  material_id: string
  description: string
  category: string | null
  currency: string | null
  history_months: number
  usable_history_months: number
  supported_horizons_days: number[]
}

export interface MaterialList {
  has_data: boolean
  as_of: string | null
  materials: ForecastableMaterial[]
}

export interface PathPoint {
  month: string
  value: number
  lower: number | null
  upper: number | null
}

export interface Candidate {
  code: string
  name: string
  version: string
  kind: 'baseline' | 'regression'
  params: Record<string, number>
  origins_scored: number
  mae: number | null
  rmse: number | null
  mape: number | null
  directional_accuracy: number | null
  eligible: boolean
  note: string
  selected: boolean
}

export interface ForecastRun {
  run_id: string
  created_at: string
  created_by: string
  as_of: string
  dataset_id: string | null
  currency: string | null
  horizon_days: number
  horizon_months: number
  model: { code: string; name: string; version: string }
  dataset_version: string
  history: { months: number; start: string; end: string; frequency: string }
  forecast: {
    month: string
    value: number
    lower: number | null
    upper: number | null
    interval_level: number | null
    last_observed_price: number | null
    change_pct: number | null
  }
  path: PathPoint[]
  candidates: Candidate[]
  selection_rationale: string
  config: Record<string, number>
}

export interface Horizon {
  horizon_days: number
  horizon_months: number
  status: HorizonStatus
  reason: string | null
  required_months: number
  available_months: number
  run: ForecastRun | null
}

export interface HistoryPoint {
  month: string
  unit_price: number
  in_model_window: boolean
}

export interface MaterialForecasts {
  material: {
    material_id: string
    description: string
    category: string | null
    unit_of_measure: string
  }
  as_of: string
  currency: string | null
  data_frequency: string
  history: HistoryPoint[]
  usable_history_months: number
  excluded_partial_month: string | null
  horizons: Horizon[]
  computed_at: string
}
