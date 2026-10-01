import { request } from '@/lib/api'
import type {
  FieldMapping,
  PreviewData,
  RunConfig,
  RunOutcome,
  SavedProfile,
  SourceProfileKey,
  TargetsResponse,
} from './types'

const BASE = '/manufacturing/mapping'

function uploadBody(file: File, fields: Record<string, string>): FormData {
  const form = new FormData()
  form.append('file', file)
  Object.entries(fields).forEach(([key, value]) => form.append(key, value))
  return form
}

export const mappingApi = {
  getTargets: () => request<TargetsResponse>(`${BASE}/targets`),

  preview: (file: File, target: string, sheet?: string | null) =>
    request<PreviewData>(`${BASE}/preview`, {
      method: 'POST',
      body: uploadBody(file, { target, ...(sheet ? { sheet } : {}) }),
    }),

  validate: (file: File, config: RunConfig) =>
    request<RunOutcome>(`${BASE}/validate`, {
      method: 'POST',
      body: uploadBody(file, { config: JSON.stringify(config) }),
    }),

  runImport: (file: File, config: RunConfig) =>
    request<RunOutcome>(`${BASE}/import`, {
      method: 'POST',
      body: uploadBody(file, { config: JSON.stringify(config) }),
    }),

  listProfiles: (target: string) =>
    request<{ profiles: SavedProfile[] }>(`${BASE}/profiles?target=${encodeURIComponent(target)}`),

  saveProfile: (payload: {
    name: string
    description?: string
    source_profile: SourceProfileKey
    target: string
    field_mapping: FieldMapping
    defaults: FieldMapping
  }) => request<SavedProfile>(`${BASE}/profiles`, { method: 'POST', body: JSON.stringify(payload) }),

  errorLogUrl: (jobId: string) => `/api/v1${BASE}/jobs/${encodeURIComponent(jobId)}/errors.csv`,
}
