import { request } from '@/lib/api'
import type { MaterialScores, RunResult, ScoreList } from './types'

const BASE = '/manufacturing/risk-scoring'

function query(params: Record<string, string>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const riskApi = {
  scores: (asOf: string, dataset: string) =>
    request<ScoreList>(`${BASE}/scores${query({ as_of: asOf, dataset_id: dataset })}`),

  material: (materialId: string, asOf: string, dataset: string) =>
    request<MaterialScores>(
      `${BASE}/materials/${encodeURIComponent(materialId)}${query({ as_of: asOf, dataset_id: dataset })}`
    ),

  run: (asOf: string, dataset: string, materialId?: string) =>
    request<RunResult>(
      `${BASE}/run${query({ as_of: asOf, dataset_id: dataset, material_id: materialId ?? '' })}`,
      { method: 'POST' }
    ),
}
