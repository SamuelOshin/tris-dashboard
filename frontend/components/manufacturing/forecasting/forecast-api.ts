import { request } from '@/lib/api'
import type { MaterialForecasts, MaterialList } from './types'

const BASE = '/manufacturing/forecasting'

export const forecastApi = {
  materials: () => request<MaterialList>(`${BASE}/materials`),

  forecasts: (materialId: string) =>
    request<MaterialForecasts>(`${BASE}/materials/${encodeURIComponent(materialId)}`),

  run: (materialId: string) =>
    request<MaterialForecasts>(`${BASE}/materials/${encodeURIComponent(materialId)}/run`, {
      method: 'POST',
    }),
}
