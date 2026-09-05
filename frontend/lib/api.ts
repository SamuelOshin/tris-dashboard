/**
 * Typed API Client for TRIS Risk Intelligence Platform.
 * Consumes FastAPI /api/v1/ backend via Next.js rewrites proxy.
 */
import { toast } from 'sonner'

export interface ApiResponse<T> {
  status: 'SUCCESS' | 'ERROR'
  status_code: number
  message: string
  data: T
  error_code?: string
  errors?: Record<string, string[]>
}

export interface User {
  user_id: string
  username: string
  name: string
  email: string
  role: string
  department: string
  is_active: boolean
}

export interface Supplier {
  supplier_id: string
  name: string
  category: string
  risk_tier: string
  bank_account?: string
  routing_number?: string
  bank_change_date?: string
  bank_change_reason?: string
  status: string
  notes?: string
  created_at: string
}

export interface Transaction {
  transaction_id: string
  supplier_id: string
  invoice_number: string
  amount: number
  currency: string
  invoice_date: string
  due_date?: string
  posting_date?: string
  approval_required: boolean
  approval_status: string
  payment_status: string
  description?: string
  created_at: string
}

export interface BaselineStats {
  supplier_id: string
  supplier_name: string
  invoice_count: number
  mean_amount: number
  median_amount: number
  min_amount: number
  max_amount: number
  std_dev: number
  historical_only?: boolean
  excluded_tx_id?: string
  excluded_transaction_id?: string
  baseline_transaction_ids: string[]
}

export interface AccessEvent {
  event_id: string
  user_id: string
  event_time: string
  system: string
  action: string
  resource: string
  supplier_id?: string
  result: string
  location_context?: string
  notes?: string
  flagged: boolean
  created_at: string
}

export interface AccessEventStats {
  total_events: number
  off_hours_events: number
  unique_users: number
  unique_systems: number
}

export interface RuleConfig {
  rule_id?: number
  rule_code: string
  name: string
  description: string
  weight: number
  threshold_params: Record<string, any>
  rule_version: number
  is_active: boolean
  updated_at: string
}

export interface RuleSignal {
  rule_code: string
  rule_name: string
  rule_version: number
  triggered: boolean
  weight: number
  score: number
  explanation: string
  diagnostics: Record<string, any>
}

export interface CaseHistoryItem {
  history_id?: number
  case_id: string
  actor: string
  action: string
  previous_status?: string
  new_status: string
  note?: string
  timestamp: string
}

export interface RiskCase {
  case_id: string
  case_number: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'New' | 'Assigned' | 'Under Investigation' | 'Corrective Action' | 'Pending Verification' | 'Closed' | 'Reopened'
  supplier_id: string
  transaction_id: string
  assigned_to?: string
  trigger_signals: RuleSignal[]
  evaluation_snapshot: Record<string, any>

  // 8 Mandatory Closure Fields
  root_cause?: string
  corrective_action?: string
  closure_type?: string
  closure_evidence?: string
  verified_by?: string
  closure_date?: string
  follow_up_requirement?: string
  recurrence_monitoring?: string

  history?: CaseHistoryItem[]
  prior_cases?: any[]
  created_at: string
  updated_at: string
}

export interface CaseTransitionPayload {
  to_status: string
  actor: string
  note?: string
  assigned_to?: string
  root_cause?: string
  corrective_action?: string
  closure_type?: string
  closure_evidence?: string
  verified_by?: string
  closure_date?: string
  follow_up_requirement?: string
  recurrence_monitoring?: string
}

export interface Notification {
  notification_id: string
  recipient_user_id?: string | null
  recipient_role?: string | null
  title: string
  message: string
  category: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS'
  link_url?: string | null
  is_read: boolean
  read_at?: string | null
  metadata_json?: Record<string, any> | null
  created_at: string
}

export interface NotificationFilters {
  limit?: number
  offset?: number
  unread_only?: boolean
  category?: string
  severity?: string
}

const API_BASE = '/api/v1'

export class ApiError extends Error {
  code?: string
  status?: number
  errors?: Record<string, string[]>

  constructor(message: string, code?: string, status?: number, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.errors = errors
  }
}

export interface RequestOptions extends RequestInit {
  silent?: boolean
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  // Token is in the server-set HttpOnly cookie, sent automatically by credentials: 'include'.
  // No manual Authorization header needed.

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  let json: ApiResponse<T> | null = null
  try {
    json = await response.json()
  } catch {
    // Non-JSON response body (e.g. proxy HTML 502/504)
  }

  // Session probe check: unauthenticated response from /auth/me is an expected state,
  // never an error that should be toasted to the user.
  const isAuthProbe =
    endpoint.startsWith('/auth/me') &&
    (response.status === 401 || json?.status_code === 401 || json?.error_code === 'AUTHENTICATION_FAILED')

  if (!response.ok || (json && json.status === 'ERROR')) {
    let errorMsg =
      json?.message ||
      (response.statusText
        ? `Server error (${response.status}): ${response.statusText}`
        : 'An unexpected error occurred. Please try again.')

    // Normalize any legacy raw Python syntax from backend into clean human copy
    if (json?.error_code === 'PERMISSION_DENIED' || response.status === 403) {
      if (errorMsg.includes("['") || errorMsg.includes("Required role:")) {
        errorMsg = errorMsg
          .replace(/\[([^\]]+)\]/g, (_, r) => r.replace(/['"]/g, '').split(', ').join(', '))
          .replace(
            /Role '([^']+)' is not authorized for this operation\. Required role: (.*)/i,
            'Access restricted: Your account ($1) does not have permission for this action. Required clearance: $2.'
          )
      }
    }

    // Surface failed requests globally unless explicitly silenced or probing authentication state
    if (!options.silent && !isAuthProbe) {
      toast.error(errorMsg)
    }
    throw new ApiError(errorMsg, json?.error_code, json?.status_code || response.status, json?.errors)
  }

  if (!json) {
    const msg = 'Invalid response received from server'
    if (!options.silent && !isAuthProbe) {
      toast.error(msg)
    }
    throw new ApiError(msg, 'INVALID_RESPONSE', response.status)
  }

  return json.data
}

export const api = {
  // Auth
  login: async (username: string, password: string): Promise<{ user: User }> => {
    const data = await request<{
      user_id: string
      username: string
      name: string
      email: string
      role: string
      department: string
      is_active: boolean
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      silent: true,
    })
    const user: User = {
      user_id: data.user_id,
      username: data.username,
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department,
      is_active: data.is_active,
    }
    // Web client relies strictly on the server-set HttpOnly cookie.
    // The JSON access_token is ignored and not exposed to the application.
    return { user }
  },

  getMe: async (): Promise<User> => {
    return request<User>('/auth/me', { silent: true })
  },

  logout: async (): Promise<void> => {
    try {
      await request('/auth/logout', { method: 'POST', silent: true })
    } finally {
      // Server deletes the HttpOnly cookie via delete_cookie().
      // No localStorage to clear.
    }
  },

  // Ingestion
  uploadWorkbook: async (
    file: File,
    duplicateStrategy: 'skip' | 'update' | 'fail' = 'skip'
  ): Promise<{ job_id: string; status: string; filename: string; check_status_url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    return request(`/ingest/upload?duplicate_strategy=${duplicateStrategy}`, {
      method: 'POST',
      body: formData,
    })
  },

  getIngestionJob: async (jobId: string): Promise<Record<string, any>> => {
    return request(`/ingest/jobs/${jobId}`)
  },

  getIngestionJobs: async (
    limit: number = 20,
    offset: number = 0
  ): Promise<{ jobs: Record<string, any>[]; limit: number; offset: number }> => {
    return request(`/ingest/jobs?limit=${limit}&offset=${offset}`)
  },

  // Suppliers & Baseline
  getSuppliers: async (): Promise<Supplier[]> => {
    return request<Supplier[]>('/suppliers')
  },

  getSupplier: async (id: string): Promise<Supplier> => {
    return request<Supplier>(`/suppliers/${id}`)
  },

  getSupplierBaseline: async (id: string, excludeTx?: string): Promise<BaselineStats> => {
    const query = excludeTx ? `?exclude_tx=${encodeURIComponent(excludeTx)}` : ''
    return request<BaselineStats>(`/suppliers/${id}/baseline${query}`)
  },

  // Transactions Ledger
  getTransactions: async (supplierId?: string, skip = 0, limit = 100): Promise<Transaction[]> => {
    const params = new URLSearchParams()
    if (supplierId) params.append('supplier_id', supplierId)
    params.append('skip', String(skip))
    params.append('limit', String(limit))
    return request<Transaction[]>(`/transactions?${params.toString()}`)
  },

  // Rules Engine
  getRules: async (): Promise<RuleConfig[]> => {
    return request<RuleConfig[]>('/rules')
  },

  updateRule: async (ruleCode: string, payload: Partial<RuleConfig>): Promise<RuleConfig> => {
    return request<RuleConfig>(`/rules/${ruleCode}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  evaluateTransaction: async (txId: string): Promise<any> => {
    return request(`/rules/evaluate/${txId}`, {
      method: 'POST',
    })
  },

  // Cases Lifecycle
  getCases: async (filters: { status?: string; priority?: string; supplier_id?: string } = {}): Promise<RiskCase[]> => {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.priority) params.append('priority', filters.priority)
    if (filters.supplier_id) params.append('supplier_id', filters.supplier_id)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request<RiskCase[]>(`/cases${qs}`)
  },

  getCase: async (id: string): Promise<RiskCase> => {
    return request<RiskCase>(`/cases/${id}`)
  },

  transitionCase: async (id: string, payload: CaseTransitionPayload): Promise<RiskCase> => {
    return request<RiskCase>(`/cases/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // Zero-Trust Access Telemetry
  getAccessEvents: async (filters: {
    limit?: number
    offset?: number
    is_off_hours?: boolean
    supplier_id?: string
    user_id?: string
  } = {}): Promise<AccessEvent[]> => {
    const params = new URLSearchParams()
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.offset) params.append('offset', String(filters.offset))
    if (filters.is_off_hours !== undefined) params.append('is_off_hours', String(filters.is_off_hours))
    if (filters.supplier_id) params.append('supplier_id', filters.supplier_id)
    if (filters.user_id) params.append('user_id', filters.user_id)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request<AccessEvent[]>(`/access-events${qs}`)
  },

  getAccessEventStats: async (): Promise<AccessEventStats> => {
    return request<AccessEventStats>('/access-events/stats')
  },

  // Notification Engine
  getNotifications: async (filters: NotificationFilters = {}): Promise<Notification[]> => {
    const params = new URLSearchParams()
    if (filters.limit) params.append('limit', String(filters.limit))
    if (filters.offset) params.append('offset', String(filters.offset))
    if (filters.unread_only !== undefined) params.append('unread_only', String(filters.unread_only))
    if (filters.category) params.append('category', filters.category)
    if (filters.severity) params.append('severity', filters.severity)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request<Notification[]>(`/notifications${qs}`)
  },

  getUnreadNotificationCount: async (): Promise<{ unread_count: number }> => {
    return request<{ unread_count: number }>('/notifications/unread-count')
  },

  markNotificationRead: async (notificationId: string): Promise<Notification> => {
    return request<Notification>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
    })
  },

  markAllNotificationsRead: async (): Promise<{ updated_count: number }> => {
    return request<{ updated_count: number }>('/notifications/mark-all-read', {
      method: 'POST',
    })
  },
}

export const DEFAULT_RULES_METADATA: Record<string, { name: string; description: string; weight: number; version: number }> = {
  'R-001': {
    name: 'Amount Deviation (> 2.0x baseline)',
    description: 'Transaction amount is materially above historical mean baseline.',
    weight: 35,
    version: 1,
  },
  'R-002': {
    name: 'Recent Bank Detail Change (< 7 days)',
    description: 'Supplier bank routing or account credentials modified within surveillance window.',
    weight: 25,
    version: 1,
  },
  'R-003': {
    name: 'Missing Required Level 3 Approval',
    description: 'High-value transaction lacks mandatory hierarchical CFO/Director authorization.',
    weight: 25,
    version: 1,
  },
  'R-004': {
    name: 'Off-Hours Access Telemetry',
    description: 'Related access activity occurred outside authorized operational window (06:00–20:00).',
    weight: 15,
    version: 1,
  },
  'R-005': {
    name: 'Duplicate Invoice Submission',
    description: 'Potential duplicate invoice detected with matching amount and vendor within 30 days.',
    weight: 30,
    version: 1,
  },
  'R-006': {
    name: 'Historical Recurrence Surveillance',
    description: 'Vendor has prior control failure violations recorded within active lookback window.',
    weight: 20,
    version: 1,
  },
}

export function getCompositeScore(c: RiskCase): number {
  if (!c) return 0
  if (c.evaluation_snapshot && typeof c.evaluation_snapshot.composite_score === 'number') {
    return c.evaluation_snapshot.composite_score
  }
  if (Array.isArray(c.trigger_signals) && c.trigger_signals.length > 0) {
    const sum = c.trigger_signals.reduce((acc, s) => {
      const pts = s.score ?? s.weight ?? DEFAULT_RULES_METADATA[s.rule_code]?.weight ?? 0
      return acc + pts
    }, 0)
    if (sum > 0) return sum
  }
  const p = (c.priority || '').toLowerCase()
  if (p === 'high') return 100
  if (p === 'medium') return 50
  return 20
}

export function enrichSignal(signal: RuleSignal): RuleSignal {
  const meta = DEFAULT_RULES_METADATA[signal.rule_code]
  return {
    rule_code: signal.rule_code,
    rule_name: signal.rule_name || meta?.name || `Rule ${signal.rule_code}`,
    rule_version: signal.rule_version || meta?.version || 1,
    triggered: signal.triggered !== false,
    weight: signal.weight || meta?.weight || 25,
    score: signal.score ?? signal.weight ?? meta?.weight ?? 25,
    explanation: signal.explanation || meta?.description || 'Automated rule violation detected.',
    diagnostics: signal.diagnostics || {},
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

