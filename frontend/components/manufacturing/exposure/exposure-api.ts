import { request } from '@/lib/api'
import type { ExposureResponse, ScenarioInputs } from './types'

const BASE = '/manufacturing/exposure'

export const exposureApi = {
  baseline: (horizonDays: number, materialId: string | null) => {
    const params = new URLSearchParams({ horizon_days: String(horizonDays) })
    if (materialId) params.set('material_id', materialId)
    return request<ExposureResponse>(`${BASE}?${params}`)
  },

  /** Recalculates exposure under a what-if. Nothing is saved on the server. */
  scenario: (horizonDays: number, materialId: string | null, scenario: ScenarioInputs) =>
    request<ExposureResponse>(`${BASE}/scenario`, {
      method: 'POST',
      body: JSON.stringify({ horizon_days: horizonDays, material_id: materialId, scenario }),
    }),
}
