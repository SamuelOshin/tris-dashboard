export type SourceProfileKey = 'generic' | 'sap_style' | 'dynamics_style'
/** The UI also offers a previously saved profile as a starting point. */
export type ProfileChoice = SourceProfileKey | 'saved'
export type WizardStep = 'upload' | 'mapping' | 'results'
export type DuplicateStrategy = 'skip' | 'fail'

export interface FieldInfo {
  name: string
  kind: 'str' | 'float' | 'int' | 'date' | 'bool'
  required: boolean
  description: string
  default: string | number | boolean | null
  references: string | null
}

export interface TargetInfo {
  key: string
  label: string
  description: string
  fields: FieldInfo[]
  any_of: string[][]
}

export interface SourceProfileInfo {
  key: SourceProfileKey
  label: string
}

export interface TargetsResponse {
  targets: TargetInfo[]
  source_profiles: SourceProfileInfo[]
}

export type FieldMapping = Record<string, string>

export interface PreviewData {
  filename: string
  columns: string[]
  sample_rows: Record<string, string | null>[]
  total_rows: number
  blank_rows: number
  malformed_rows: number
  sheets: string[]
  selected_sheet: string | null
  target: string
  suggestions: Record<SourceProfileKey, FieldMapping>
  suggested_profile: SourceProfileKey
}

export interface SavedProfile {
  profile_id: string
  name: string
  description: string | null
  source_profile: SourceProfileKey
  target: string
  field_mapping: FieldMapping
  defaults: FieldMapping
  created_at: string
}

export interface RunConfig {
  target: string
  source_profile: SourceProfileKey
  field_mapping: FieldMapping
  defaults: FieldMapping
  dataset_id?: string | null
  duplicate_strategy: DuplicateStrategy
  sheet?: string | null
  profile_id?: string | null
}

export interface CircuitBreakerInfo {
  tripped: boolean
  stage: string
  error_count: number
  total_rows: number
  ratio: number
  threshold: number
  message: string
  suspect_field?: string
  suspect_column?: string | null
  hint?: string
}

export interface RunWarning {
  code: string
  field: string
  count: number
  message: string
}

export interface ErrorLogEntry {
  sheet: string
  row: number
  field: string
  error: string
  raw_value: Record<string, unknown>
}

export interface RunSummary {
  target_label: string
  source_profile_label: string
  dry_run: boolean
  rows_total: number
  rows_accepted: number
  rows_rejected: number
  rows_duplicate: number
  rows_blank: number
  warnings: RunWarning[]
  missing_values: Record<string, number>
  unmapped_optional_fields: string[]
  errors_total: number
  error_log_truncated: boolean
  circuit_breaker: CircuitBreakerInfo | null
}

export interface RunOutcome {
  job_id: string | null
  status: 'VALIDATED' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED'
  summary: RunSummary
  error_log: ErrorLogEntry[]
}
