export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical'

export interface ScoreSummary {
  score_id: string
  material_id: string
  as_of: string
  currency: string | null
  score: number
  level: RiskLevel
  data_coverage_pct: number
  summary: string
  method_version: string
  weight_version: number
  forecast_run_id: string | null
  created_by: string
  created_at: string
}

export interface FactorScore {
  code: string
  name: string
  weight: number
  value: number | null
  unit: string
  scale: { low: number; high: number }
  status: 'evaluated' | 'not_evaluable'
  sub_score: number | null
  effective_weight_pct: number
  points: number
  explanation: string
}

export interface ScoreDetail extends ScoreSummary {
  factors: FactorScore[]
}

export interface ScoreList {
  has_data: boolean
  as_of: string | null
  scores: ScoreSummary[]
}

export interface MaterialScores {
  material_id: string
  as_of: string | null
  current: ScoreDetail | null
  history: ScoreSummary[]
}

export interface RunResult {
  as_of: string
  weight_version: number
  scored: (ScoreSummary & { description: string })[]
  not_scored: { material_id: string; description: string; reason: string }[]
}
