export type TabId = 'models' | 'weights' | 'datasets' | 'profiles' | 'audit'

export interface ForecastModel {
  code: string
  name: string
  version: string
  kind: 'baseline' | 'regression'
  description: string
  enabled: boolean
  can_be_disabled: boolean
  last_changed_by: string | null
  last_changed_at: string | null
  last_note: string | null
}

export interface Configuration {
  forecast_models: ForecastModel[]
  forecast_settings: {
    horizons_days: number[]
    required_months: Record<string, number>
    origins_scored_per_model: number
    minimum_improvement_for_regression: number
    prediction_band: number
    months_used_by_regression: number
    note: string
  }
  risk_weights: {
    active_version: number
    method_version: string
    versions_stored: number
    saved_by: string
    saved_at: string
    note: string | null
    bands: Record<string, number>
    weights: Record<string, number>
  }
  validation_defaults: {
    horizons_days: number[]
    cutoff_step_months: number
    event_threshold_pct: number
    alert_threshold: number | null
    flat_band_pct: number
    method_version: string
  }
}

export interface WeightConfig {
  weights: Record<string, number>
  ramps: Record<string, number[]>
  bands: Record<string, number>
  min_evaluable_weight: number
}

export interface WeightVersion {
  version: number
  is_active: boolean
  config: WeightConfig
  note: string | null
  created_by: string
  created_at: string
}

export interface WeightList {
  active_version: number
  method_version: string
  versions: WeightVersion[]
}

export type DatasetLabel = 'unlabelled' | 'synthetic' | 'authorized'

export interface Dataset {
  dataset_id: string
  registered: boolean
  label: DatasetLabel
  source_type: string
  registered_by: string | null
  registered_at: string | null
  label_set_by: string | null
  label_set_at: string | null
  records: Record<string, number>
  materials_with_purchases: number
  purchases_from: string | null
  purchases_to: string | null
}

export interface MappingProfile {
  profile_id: string
  name: string
  description: string | null
  source_profile: string
  target: string
  created_by: string
  created_at: string
}

export interface AuditEvent {
  id: number
  occurred_at: string
  event_type: string
  event: string
  actor: string | null
  actor_role: string | null
  resource_type: string | null
  resource_id: string | null
  detail: string | null
}

export interface AuditPage {
  total: number
  items: AuditEvent[]
  event_types: { code: string; label: string }[]
}

export interface AuditFilters {
  event_type: string
  actor: string
  since: string
  until: string
  page: number
}
