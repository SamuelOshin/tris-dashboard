export interface ScenarioInputs {
  price_change_pct: number
  demand_change_pct: number
  lead_time_delay_days: number
  inventory_change_pct: number
  supplier_id: string | null
  supplier_price_change_pct: number
  spot_premium_pct: number
}

export interface SupplyCover {
  evaluable: boolean
  cover_days: number | null
  lead_time_days: number | null
  uncovered_days: number
  uncovered_quantity: number
}

export interface ScenarioResult {
  scenario_unit_cost: number
  scenario_usage: number
  price_effect: number
  volume_effect: number
  premium_cost: number
  scenario_spend: number
  scenario_exposure: number
  change_vs_baseline: number
  supply_cover: SupplyCover
  notes: string[]
}

export interface MaterialExposure {
  material_id: string
  description: string
  category: string | null
  unit_of_measure: string
  currency: string | null
  forecast: { run_id: string; model: string; horizon_days: number; as_of: string; stored_at: string }
  baseline_unit_cost: number
  forecast_unit_cost: number
  forecast_end_unit_cost: number
  expected_usage: number
  usage_basis: { method: string; monthly_usage: number; months_used: number }
  baseline_spend: number
  forecast_spend: number
  projected_exposure: number
  exposure_pct: number | null
  supply_cover: SupplyCover
  stale_note?: string
  scenario?: ScenarioResult
}

export interface RollupGroup {
  key: string
  materials: number
  baseline_spend: number
  forecast_spend: number
  projected_exposure: number
  scenario_spend?: number
  scenario_exposure?: number
  change_vs_baseline?: number
  premium_cost?: number
}

export interface RollupBlock {
  currency: string
  groups: RollupGroup[]
  total: Omit<RollupGroup, 'key' | 'materials'>
}

export type Dimension = 'supplier' | 'product' | 'category'

export interface ExposureResponse {
  has_data: boolean
  kind?: 'baseline' | 'scenario'
  label?: string
  as_of: string | null
  horizon_days: number
  horizon_months?: number
  usage_window_months?: number
  scenario?: ScenarioInputs | null
  materials?: MaterialExposure[]
  not_available?: { material_id: string; description: string; reason: string }[]
  rollups?: Record<Dimension, RollupBlock[]>
}
