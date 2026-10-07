import { request } from '@/lib/api'
import type { ManufacturingSummary, StoredResults } from './types'

const BASE = '/manufacturing/dashboard'

function query(params: Record<string, string>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const dashboardApi = {
  summary: () => request<ManufacturingSummary>(`${BASE}/summary`),

  materialResults: (asOf: string, dataset: string) =>
    request<StoredResults>(`${BASE}/material-results${query({ as_of: asOf, dataset_id: dataset })}`),
}
