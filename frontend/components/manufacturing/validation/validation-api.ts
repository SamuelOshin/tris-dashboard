import { request } from '@/lib/api'
import type { RunDetail, RunListItem, RunRequest } from './types'

const BASE = '/manufacturing/validation'

export const validationApi = {
  runs: () => request<RunListItem[]>(`${BASE}/runs`),

  run: (runId: string) => request<RunDetail>(`${BASE}/runs/${encodeURIComponent(runId)}`),

  /** Runs the retrospective check on stored data and saves the run. It can take a minute. */
  start: (body: RunRequest) =>
    request<RunDetail>(`${BASE}/runs`, { method: 'POST', body: JSON.stringify(body) }),
}
