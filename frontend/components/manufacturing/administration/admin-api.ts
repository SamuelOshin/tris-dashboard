import { request } from '@/lib/api'
import type {
  AuditFilters,
  AuditPage,
  Configuration,
  Dataset,
  DatasetLabel,
  ForecastModel,
  MappingProfile,
  WeightConfig,
  WeightList,
} from './types'

const ADMIN = '/manufacturing/admin'
export const PAGE_SIZE = 25

export const adminApi = {
  configuration: () => request<Configuration>(`${ADMIN}/configuration`),

  setModel: (code: string, enabled: boolean, note: string | null) =>
    request<{ models: ForecastModel[] }>(`${ADMIN}/models/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled, note }),
    }),

  datasets: () => request<{ datasets: Dataset[] }>(`${ADMIN}/datasets`),

  setDatasetLabel: (id: string, label: DatasetLabel) =>
    request<{ datasets: Dataset[] }>(`${ADMIN}/datasets/${encodeURIComponent(id)}/label`, {
      method: 'PUT',
      body: JSON.stringify({ label }),
    }),

  weights: () => request<WeightList>('/manufacturing/risk-scoring/weights'),

  saveWeights: (config: WeightConfig, note: string) =>
    request('/manufacturing/risk-scoring/weights', {
      method: 'POST',
      body: JSON.stringify({ config, note }),
    }),

  profiles: () => request<{ profiles: MappingProfile[] }>('/manufacturing/mapping/profiles'),

  deleteProfile: (id: string) =>
    request(`/manufacturing/mapping/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  audit: (f: AuditFilters) => {
    const q = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(f.page * PAGE_SIZE) })
    if (f.event_type) q.set('event_type', f.event_type)
    if (f.actor.trim()) q.set('actor', f.actor.trim())
    if (f.since) q.set('since', f.since)
    if (f.until) q.set('until', f.until)
    return request<AuditPage>(`${ADMIN}/audit-events?${q.toString()}`)
  },
}
