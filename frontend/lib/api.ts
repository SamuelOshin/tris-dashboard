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
  created_at?: string
}

export interface UserAdminRecord {
  user_id: string
  username: string
  name: string
  email: string
  role: string
  department: string
  is_active: boolean
  created_at: string
}

export interface UserCreatePayload {
  name: string
  email: string
  username?: string
  role: string
  department?: string
  temporary_password?: string
}

export interface UserCreatedResult extends UserAdminRecord {
  temporary_password: string
}

export interface UserUpdatePayload {
  name?: string
  role?: string
  department?: string
  is_active?: boolean
}

export interface PasswordResetResult {
  user_id: string
  username: string
  temporary_password: string
  message: string
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
  rule_description?: string

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

// ---------------------------------------------------------------------------
// Historical Reconstruction & Remediation Replay Interfaces
// ---------------------------------------------------------------------------

export interface ProvenanceFact {
  field: string
  value: any
  source_record_id: string
  source_table: string
  effective_from?: string | null
  recorded_at?: string | null
}

export interface SupplierStateAtEvent {
  supplier_id: string
  name: string | null
  category: string | null
  risk_tier: string | null
  bank_change_date: string | null
  bank_changed_within_7_days: boolean
  provenance: ProvenanceFact[]
}

export interface ApprovalItem {
  approval_id: string
  required_level?: string
  approver_name?: string | null
  approver_role?: string
  approval_status?: string
  approval_date?: string | null
  exclusion_reason?: string
  notes?: string | null
}

export interface ApprovalStateAtEvent {
  effective_approvals: ApprovalItem[]
  excluded_late_approvals: ApprovalItem[]
  highest_effective_level?: string | null
  provenance: ProvenanceFact[]
}

export interface AccessStateAtEvent {
  elevated_access_active: boolean
  active_access_events: Array<{
    event_id: string
    user_id: string
    action: string
    resource: string
    event_time?: string | null
    system: string
  }>
  provenance: ProvenanceFact[]
}

export interface TransactionStateAtEvent {
  transaction_id: string
  amount: number
  currency: string
  invoice_date: string
  approval_required: boolean
  approval_status_at_event: string
  provenance: ProvenanceFact[]
}

export interface ApplicableRuleAtEvent {
  rule_code: string
  rule_name: string
  rule_version: number
  threshold_params: Record<string, any>
  provenance: ProvenanceFact[]
}

export interface EvidenceCompleteness {
  supplier_state: string
  approval_state: string
  access_state: string
  transaction_state: string
  rule_version: string
  overall: string
}

export interface ReconstructionResult {
  transaction_id: string
  case_id?: string | null
  event_timestamp: string
  outcome: 'PASS' | 'FAIL' | 'UNKNOWN'
  explanation: string
  supplier_state?: SupplierStateAtEvent | null
  approval_state?: ApprovalStateAtEvent | null
  access_state?: AccessStateAtEvent | null
  transaction_state?: TransactionStateAtEvent | null
  applicable_rule?: ApplicableRuleAtEvent | null
  evidence_completeness: EvidenceCompleteness
  snapshot_id?: number | null
}

export interface ProposedControl {
  control_id: string
  name: string
  description: string
  amount_threshold: number
  bank_change_window_days: number
  required_approval_level: string
  action_policy: 'BLOCK/PREVENT' | 'ESCALATE/HOLD' | 'ALLOW'
  version: number
  is_active: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface RemediationReplayResult {
  replay_id?: number | null
  control_id: string
  transaction_id: string
  case_id?: string | null
  event_timestamp: string
  replay_determination: 'ALLOW' | 'ESCALATE/HOLD' | 'BLOCK/PREVENT' | 'NOT DETERMINABLE'
  original_outcome: string
  proposed_control_outcome: string
  explanation: string
  driving_facts: {
    amount: number
    amount_threshold: number
    amount_exceeded: boolean
    supplier_id: string
    bank_change_date: string | null
    bank_changed_within_window: boolean
    window_days: number
    days_since_bank_change: number | null
    requires_independent_verification: boolean
    required_approval_level: string
    effective_highest_approval_level: string | null
    effective_approvals_count: number
    effective_approval_ids: string[]
    independent_verification_present: boolean
    excluded_late_approvals_count: number
    excluded_late_approval_ids: string[]
    action_policy: string
  }
  replay_payload: Record<string, any>
  reconstruction_snapshot_id?: number | null
  executed_by?: string | null
  created_at: string
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

let isSessionExpiredRedirecting = false

export function resetSessionRedirectFlag() {
  isSessionExpiredRedirecting = false
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

  // Session probe check: unauthenticated response from /auth/me is an expected initial state,
  // never an error that should be toasted to the user or trigger redirect.
  const isAuthProbe =
    endpoint.startsWith('/auth/me') &&
    (response.status === 401 || json?.status_code === 401 || json?.error_code === 'AUTHENTICATION_FAILED')

  const isSessionExpired =
    (response.status === 401 || json?.status_code === 401 || json?.error_code === 'AUTHENTICATION_FAILED') &&
    !isAuthProbe

  if (isSessionExpired) {
    if (typeof window !== 'undefined' && !isSessionExpiredRedirecting) {
      isSessionExpiredRedirecting = true
      const currentPath = window.location.pathname + window.location.search
      const isAlreadyOnLogin = window.location.pathname === '/login'

      if (!isAlreadyOnLogin) {
        toast.error('Session Expired', {
          description: 'Your session has timed out. Redirecting to sign in...',
          duration: 3000,
        })
        setTimeout(() => {
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
        }, 700)
      }
    }
    throw new ApiError(
      json?.message || 'Session has expired. Please log in again.',
      'AUTHENTICATION_FAILED',
      401,
      json?.errors
    )
  }

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

  updateProfile: async (payload: { name?: string; department?: string }): Promise<User> => {
    return request<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
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

  updateCase: async (id: string, payload: Partial<RiskCase> & { note?: string }): Promise<RiskCase> => {
    return request<RiskCase>(`/cases/${id}`, {
      method: 'PATCH',
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

  // Historical Reconstruction (Ticket 7)
  getHistoricalReconstruction: async (
    transactionId: string,
    eventTimestamp?: string,
    caseId?: string
  ): Promise<ReconstructionResult> => {
    if (eventTimestamp) {
      return request<ReconstructionResult>('/reconstruction/reconstruct', {
        method: 'POST',
        body: JSON.stringify({
          transaction_id: transactionId,
          event_timestamp: eventTimestamp,
          case_id: caseId,
        }),
      })
    }
    return request<ReconstructionResult>(`/reconstruction/reconstruct/${encodeURIComponent(transactionId)}`)
  },

  // Remediation Replay (Ticket 8)
  getProposedControls: async (): Promise<ProposedControl[]> => {
    return request<ProposedControl[]>('/remediation/controls')
  },

  getReplays: async (filters: { transaction_id?: string; case_id?: string } = {}): Promise<RemediationReplayResult[]> => {
    const params = new URLSearchParams()
    if (filters.transaction_id) params.append('transaction_id', filters.transaction_id)
    if (filters.case_id) params.append('case_id', filters.case_id)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request<RemediationReplayResult[]>(`/remediation/replays${qs}`)
  },

  runRemediationReplay: async (payload: {
    transaction_id: string
    control_id?: string
    event_timestamp?: string
    case_id?: string
  }): Promise<RemediationReplayResult> => {
    return request<RemediationReplayResult>('/remediation/replay', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // ── User Management (Admin) ──────────────────────────────────────────
  getUsers: async (params?: {
    role?: string
    department?: string
    is_active?: boolean
    search?: string
  }): Promise<UserAdminRecord[]> => {
    const query = new URLSearchParams()
    if (params?.role) query.set('role', params.role)
    if (params?.department) query.set('department', params.department)
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active))
    if (params?.search) query.set('search', params.search)
    const qs = query.toString() ? `?${query.toString()}` : ''
    return request<UserAdminRecord[]>(`/users${qs}`)
  },

  createUser: async (payload: UserCreatePayload): Promise<UserCreatedResult> => {
    return request<UserCreatedResult>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateUser: async (userId: string, payload: UserUpdatePayload): Promise<UserAdminRecord> => {
    return request<UserAdminRecord>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  resetUserPassword: async (userId: string): Promise<PasswordResetResult> => {
    return request<PasswordResetResult>(`/users/${userId}/reset-password`, {
      method: 'POST',
    })
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    return request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
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

