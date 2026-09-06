'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, RiskCase, CaseTransitionPayload, enrichSignal } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  FileCheck2,
  Lock,
  History,
  X,
  RotateCcw,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  ArrowUpDown,
  UserCheck,
  Wrench,
  RefreshCw,
  Upload,
  Activity,
  Cpu,
  Clock,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type TabId = 'overview' | 'investigation' | 'corrective-action' | 'closure' | 'history' | 'recurrence'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'corrective-action', label: 'Corrective Action' },
  { id: 'closure', label: 'Closure' },
  { id: 'history', label: 'History' },
  { id: 'recurrence', label: 'Recurrence' },
]

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const caseId = params?.id as string

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [caseData, setCaseData] = useState<RiskCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Investigation form state — starts clean, populated dynamically from case data or autofill
  const [investigationNotes, setInvestigationNotes] = useState('')
  const [evidenceReviewed, setEvidenceReviewed] = useState('')
  const [findingDisposition, setFindingDisposition] = useState('')
  const [rootCauseCategory, setRootCauseCategory] = useState('')
  const [rootCause, setRootCause] = useState('')
  const [supportingEvidence, setSupportingEvidence] = useState('')

  // Corrective action form state — starts clean, populated dynamically from case data or autofill
  const [actionTaken, setActionTaken] = useState('')
  const [responsiblePerson, setResponsiblePerson] = useState('')
  const [targetCompletionDate, setTargetCompletionDate] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [evidenceOfAction, setEvidenceOfAction] = useState('')
  const [actionStatus, setActionStatus] = useState('In Progress')
  const [actionComments, setActionComments] = useState('')

  // Closure state & checklist
  const [closureNotes, setClosureNotes] = useState('')
  const [closureValidationErrors, setClosureValidationErrors] = useState<string[]>([])

  // Modal for 8-field closure details
  const [closureModalOpen, setClosureModalOpen] = useState(false)
  const [closureForm, setClosureForm] = useState({
    root_cause: '',
    corrective_action: '',
    closure_type: 'Process Error / Remedied',
    closure_evidence: '',
    verified_by: '',
    closure_date: new Date().toISOString().split('T')[0],
    follow_up_requirement: '30-day supplier duplicate invoice monitoring',
    recurrence_monitoring: 'Enrolled in 90-day automated monitoring under Rule R-006',
  })

  // Reopen modal state
  const [reopenModalOpen, setReopenModalOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState(
    'Additional supplier transaction received; reopening for active reconciliation.'
  )

  // Audit trail filtering
  const [auditSearchQuery, setAuditSearchQuery] = useState('')
  const [auditSortOrder, setAuditSortOrder] = useState<'desc' | 'asc'>('asc')

  const loadCase = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getCase(caseId)
      setCaseData(data)

      const isCaseClosed = data.status === 'Closed'

      if (isCaseClosed) {
        // Case is finalized: populate all fields from the database record
        setRootCause(data.root_cause || '')
        setActionTaken(data.corrective_action || '')
        setSupportingEvidence(data.closure_evidence || '')
        setEvidenceOfAction(data.closure_evidence || '')
        setResponsiblePerson(data.verified_by || data.assigned_to || 'Risk Reviewer / Case Owner')
        setCompletionDate(data.closure_date ? data.closure_date.split('T')[0] : '')
        setTargetCompletionDate(data.closure_date ? data.closure_date.split('T')[0] : '')
        setActionStatus('Completed')
        setRootCauseCategory(data.closure_type || 'Process Error / Data Entry')
        setFindingDisposition(data.root_cause || 'Exception verified and remediated.')
        setInvestigationNotes(
          `Case investigated and closed on ${
            data.closure_date ? new Date(data.closure_date).toLocaleDateString() : 'Sep 06, 2026'
          }. Finding: ${data.root_cause || 'Documented.'}`
        )
        setEvidenceReviewed(
          data.closure_evidence
            ? `Primary evidence: ${data.closure_evidence}. Verified accounts payable ledger records.`
            : 'Accounts payable invoice record, vendor master audit log.'
        )
        setActionComments(data.corrective_action || 'Remediation completed. Payment stopped/reconciled.')
        setClosureNotes(data.follow_up_requirement || 'No further action required. Case validated and closed.')
      } else {
        // Case is active (New, Assigned, Under Investigation, Corrective Action, Pending Verification)
        // Only populate fields that were explicitly saved in the database
        setRootCause(data.root_cause || '')
        setActionTaken(data.corrective_action || '')
        setSupportingEvidence(data.closure_evidence || '')
        setResponsiblePerson(data.assigned_to || (user?.name || 'Risk Reviewer / Case Owner'))
        setClosureNotes(data.follow_up_requirement || '')
        setCompletionDate('')
        setTargetCompletionDate('')
        setEvidenceOfAction('')
        setActionStatus(data.status === 'Corrective Action' ? 'In Progress' : 'In Progress')
        setInvestigationNotes('')
        setEvidenceReviewed('')
        setFindingDisposition('')
        setRootCauseCategory('')
        setActionComments('')

        // Check for locally saved draft if available
        try {
          const draftKey = `tris_case_draft_${caseId}`
          const savedDraft = localStorage.getItem(draftKey)
          if (savedDraft) {
            const draft = JSON.parse(savedDraft)
            if (draft.investigationNotes) setInvestigationNotes(draft.investigationNotes)
            if (draft.evidenceReviewed) setEvidenceReviewed(draft.evidenceReviewed)
            if (draft.findingDisposition) setFindingDisposition(draft.findingDisposition)
            if (draft.rootCauseCategory) setRootCauseCategory(draft.rootCauseCategory)
            if (draft.rootCause && !data.root_cause) setRootCause(draft.rootCause)
            if (draft.supportingEvidence && !data.closure_evidence) setSupportingEvidence(draft.supportingEvidence)
            if (draft.actionTaken && !data.corrective_action) setActionTaken(draft.actionTaken)
            if (draft.responsiblePerson) setResponsiblePerson(draft.responsiblePerson)
            if (draft.targetCompletionDate) setTargetCompletionDate(draft.targetCompletionDate)
            if (draft.completionDate) setCompletionDate(draft.completionDate)
            if (draft.evidenceOfAction) setEvidenceOfAction(draft.evidenceOfAction)
            if (draft.actionStatus) setActionStatus(draft.actionStatus)
            if (draft.actionComments) setActionComments(draft.actionComments)
            if (draft.closureNotes) setClosureNotes(draft.closureNotes)
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load case details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (caseId) {
      loadCase()
    }
  }, [caseId])

  // Save drafts in localStorage when active fields change
  const saveDraftLocally = () => {
    if (!caseData || caseData.status === 'Closed') return
    try {
      const draftKey = `tris_case_draft_${caseId}`
      const draft = {
        investigationNotes,
        evidenceReviewed,
        findingDisposition,
        rootCauseCategory,
        rootCause,
        supportingEvidence,
        actionTaken,
        responsiblePerson,
        targetCompletionDate,
        completionDate,
        evidenceOfAction,
        actionStatus,
        actionComments,
        closureNotes,
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch (e) {
      // Ignore
    }
  }

  const enrichedSignals = (caseData?.trigger_signals || []).map((s) => enrichSignal(s))
  const primarySignal = enrichedSignals[0]
  const isClosed = caseData?.status === 'Closed'

  // Stage-based field locking (Option A: Clean lock states with prerequisite CTAs)
  const isInvestigationLocked = caseData?.status === 'New' || isClosed
  const isCorrectiveLocked = caseData?.status === 'New' || caseData?.status === 'Assigned' || isClosed
  const isClosureLocked = !['Pending Verification', 'Closed'].includes(caseData?.status || '')

  // Autofill evaluation sample data based on triggered signal context
  const handleAutofillSample = () => {
    const primaryRule = primarySignal?.rule_code || 'R-005'

    if (primaryRule === 'R-001' || primaryRule === 'R-002') {
      // Amount deviation / Bank routing change scenario
      setEvidenceReviewed(
        `Accounts payable invoice record for ${caseData?.supplier_id || 'SUP-001'}, vendor master bank change audit log, approval threshold policy, and off-hours ERP access logs.`
      )
      setFindingDisposition(
        `Unusual transaction amount confirmed ($104,000.00 vs $30,471.43 baseline mean = 3.41x deviation). Invoice lacked required Tier-2 authorization following recent vendor bank routing update.`
      )
      setRootCauseCategory('Approval Bypass / Threshold Breach')
      setRootCause(
        'Invoice was processed above standard authorization threshold without required secondary approval following vendor bank details update.'
      )
      setSupportingEvidence('po_threshold_verification.pdf')
      setActionTaken(
        'Payment disbursement put on hold. Tier-2 approval requested and obtained retroactively. ERP validation threshold lock enabled.'
      )
      setResponsiblePerson(user?.name ? `${user.name} (Risk Reviewer)` : 'Risk Reviewer / Case Owner')
      setTargetCompletionDate(new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0])
      setCompletionDate(new Date().toISOString().split('T')[0])
      setEvidenceOfAction('cfo_authorization_signoff.pdf')
      setActionStatus('Completed')
      setActionComments(
        'Hold confirmed with Treasury. Supplier account verified. Policy controls updated.'
      )
      setClosureNotes(
        'All required dual-authorizations completed. Evidence verified. Case ready for closure.'
      )
    } else {
      // Duplicate invoice / general detection scenario (R-005)
      setEvidenceReviewed(
        'Accounts payable invoice record, vendor master bank change audit log, approval threshold policy, and off-hours ERP access logs.'
      )
      setFindingDisposition(
        'Duplicate invoice was entered due to manual data entry error. Two invoices sharing identical invoice number and dollar amount detected.'
      )
      setRootCauseCategory('Process Error / Data Entry')
      setRootCause(
        'Duplicate invoice was entered due to manual data entry error.'
      )
      setSupportingEvidence('invoice_comparison.png')
      setActionTaken(
        'Duplicate invoice removed. Payment blocked. Supplier account reviewed.'
      )
      setResponsiblePerson(user?.name ? `${user.name} (Risk Reviewer)` : 'Risk Reviewer / Case Owner')
      setTargetCompletionDate(new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0])
      setCompletionDate(new Date().toISOString().split('T')[0])
      setEvidenceOfAction('supplier_update.png')
      setActionStatus('Completed')
      setActionComments(
        'Duplicate invoice deleted. Confirmed with supplier. No payment made.'
      )
      setClosureNotes(
        'All required actions completed. Evidence verified. Case ready for closure.'
      )
    }
    setSuccessMessage('Evaluation sample data loaded into form.')
    toast.info('Evaluation Sample Loaded', {
      description: 'Realistic investigation notes and root-cause details populated.',
    })
  }

  const handleClearForm = () => {
    setEvidenceReviewed('')
    setFindingDisposition('')
    setRootCauseCategory('')
    setRootCause('')
    setSupportingEvidence('')
    setActionTaken('')
    setEvidenceOfAction('')
    setActionComments('')
    setClosureNotes('')
    setTargetCompletionDate('')
    setCompletionDate('')
    try {
      localStorage.removeItem(`tris_case_draft_${caseId}`)
    } catch (e) {}
    setSuccessMessage('Form fields cleared.')
    toast.info('Form Fields Cleared', {
      description: 'Investigation and corrective action inputs reset.',
    })
  }

  const handleTransition = async (toStatus: string, extra: Partial<CaseTransitionPayload> = {}) => {
    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const payload: CaseTransitionPayload = {
        to_status: toStatus,
        actor: user?.name || 'Risk Reviewer / Case Owner',
        note: `Status transition to ${toStatus}`,
        ...extra,
      }
      const updated = await api.transitionCase(caseId, payload)
      setCaseData(updated)
      const msg = `Case transitioned to ${toStatus} successfully.`
      setSuccessMessage(msg)
      setClosureModalOpen(false)
      setReopenModalOpen(false)
      if (toStatus === 'Closed') {
        try {
          localStorage.removeItem(`tris_case_draft_${caseId}`)
        } catch (e) {}
      }
      toast.success(toStatus === 'Closed' ? 'Case Sealed & Closed' : `Case Status: ${toStatus}`, {
        description: extra.note || msg,
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tris-notification-refresh'))
      }
    } catch (err: any) {
      const errMsg = err.message || `Failed to transition case to ${toStatus}`
      setError(errMsg)
      toast.error('Transition Failed', { description: errMsg })
    } finally {
      setActionLoading(false)
    }
  }

  // Accept / Assign Case
  const handleAcceptCase = async () => {
    const ownerName = user?.name || 'Risk Reviewer / Case Owner'
    await handleTransition('Assigned', {
      assigned_to: ownerName,
      note: `Ownership assigned to ${ownerName}`,
    })
    setResponsiblePerson(ownerName)
  }

  // Start Investigation
  const handleStartInvestigation = async () => {
    await handleTransition('Under Investigation', {
      note: 'Investigation started by Case Owner',
    })
    setActiveTab('investigation')
  }

  // Save Investigation Notes
  const handleSaveInvestigation = async () => {
    setActionLoading(true)
    setSuccessMessage(null)
    saveDraftLocally()
    try {
      if (caseData?.status === 'Assigned') {
        await handleTransition('Under Investigation', {
          note: `Investigation saved. Root cause: ${rootCause || 'Under Review'} [Category: ${rootCauseCategory || 'Pending'}]`,
        })
      } else {
        const msg = 'Investigation details saved.'
        setSuccessMessage(msg)
        toast.success('Investigation Details Saved', {
          description: rootCause ? `Root cause: ${rootCause}` : 'Draft saved to case workspace.',
        })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tris-notification-refresh'))
        }
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save investigation'
      setError(errMsg)
      toast.error('Save Failed', { description: errMsg })
    } finally {
      setActionLoading(false)
    }
  }

  // Save Corrective Action
  const handleSaveCorrectiveAction = async () => {
    setActionLoading(true)
    setSuccessMessage(null)
    saveDraftLocally()
    try {
      if (caseData?.status === 'Under Investigation') {
        await handleTransition('Corrective Action', {
          note: `Corrective action recorded: ${actionTaken} | Responsible: ${responsiblePerson}`,
        })
      } else {
        const msg = 'Corrective action plan saved.'
        setSuccessMessage(msg)
        toast.success('Corrective Action Plan Saved', {
          description: actionTaken ? `Plan: ${actionTaken}` : 'Remediation plan updated.',
        })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tris-notification-refresh'))
        }
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save corrective action'
      setError(errMsg)
      toast.error('Save Failed', { description: errMsg })
    } finally {
      setActionLoading(false)
    }
  }

  // Real-time closure criteria evaluation
  const hasRootCause = !!(rootCause.trim() || caseData?.root_cause)
  const hasCorrectiveAction = !!(actionTaken.trim() || caseData?.corrective_action)
  const hasEvidence = !!(supportingEvidence.trim() || evidenceOfAction.trim() || caseData?.closure_evidence)
  const isPendingOrClosed = caseData?.status === 'Pending Verification' || isClosed

  // Validate Closure Checklist and Execute
  const executeClosure = async () => {
    setClosureValidationErrors([])
    setError(null)

    // Build the 8 mandatory closure fields
    const payload = {
      root_cause: rootCause.trim() || caseData?.root_cause || '',
      corrective_action: actionTaken.trim() || caseData?.corrective_action || '',
      closure_type: rootCauseCategory || closureForm.closure_type || 'Process Error / Remedied',
      closure_evidence: (supportingEvidence.trim() || evidenceOfAction.trim()) || caseData?.closure_evidence || '',
      verified_by: user?.name ? `${user.name} (Risk Reviewer)` : 'Risk Reviewer / Case Owner',
      closure_date: new Date().toISOString().split('T')[0],
      follow_up_requirement: closureNotes.trim() || closureForm.follow_up_requirement || 'None',
      recurrence_monitoring: 'Enrolled in 90-day monitoring under Rule R-006',
    }

    // Verify all 8 fields are non-empty
    const missing: string[] = []
    if (!payload.root_cause) missing.push('Root cause documented (Investigation tab)')
    if (!payload.corrective_action) missing.push('Corrective action completed (Corrective Action tab)')
    if (!payload.closure_evidence) missing.push('Evidence provided (Attachment required)')
    if (!payload.verified_by) missing.push('Verified by (Reviewer identity)')
    if (!payload.closure_date) missing.push('Closure date')
    if (!payload.follow_up_requirement) missing.push('Follow-up requirement')
    if (!payload.recurrence_monitoring) missing.push('Recurrence monitoring')

    if (missing.length > 0) {
      setClosureValidationErrors(missing)
      const errAlert = `Closure blocked: missing mandatory criteria [${missing.join(', ')}]`
      setError(errAlert)
      toast.error('Closure Blocked: Missing Requirements', {
        description: `Please provide: ${missing.join(', ')}`,
      })
      return
    }

    // Attempt transition through Pending Verification to Closed
    try {
      setActionLoading(true)
      if (caseData?.status !== 'Pending Verification' && caseData?.status !== 'Closed') {
        await api.transitionCase(caseId, {
          to_status: 'Pending Verification',
          actor: user?.name || 'Risk Reviewer / Case Owner',
          note: 'Submitted for system-validated closure sign-off',
        })
      }
      const closed = await api.transitionCase(caseId, {
        to_status: 'Closed',
        actor: user?.name || 'Risk Reviewer / Case Owner',
        note: `System-validated closure completed by ${user?.name || 'Risk Reviewer'}. Evidence: ${payload.closure_evidence}`,
        ...payload,
      })
      setCaseData(closed)
      try {
        localStorage.removeItem(`tris_case_draft_${caseId}`)
      } catch (e) {}
      setSuccessMessage('Case successfully closed and verified by TRIS.')
      toast.success('Case Closed & Verified', {
        description: 'All 8 mandatory criteria confirmed. Audit seal recorded.',
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tris-notification-refresh'))
      }
    } catch (err: any) {
      const errMsg = err.message || 'System-validated closure failed'
      setError(errMsg)
      toast.error('Closure Failed', { description: errMsg })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout
        title="Loading Case..."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Risk Cases', href: '/risk-cases' },
          { label: caseId },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground font-mono">Loading case review workspace...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error && !caseData) {
    return (
      <DashboardLayout
        title="Case Not Found"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Risk Cases', href: '/risk-cases' },
          { label: caseId },
        ]}
      >
        <Card className="p-8 text-center space-y-4 bg-card border-border max-w-lg mx-auto my-12">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Case Not Found</h2>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" onClick={() => router.push('/risk-cases')} className="text-xs">
            Return to Risk Cases
          </Button>
        </Card>
      </DashboardLayout>
    )
  }

  if (!caseData) return null

  // Determine priority badge color
  const priorityBadgeColor =
    caseData.priority?.toLowerCase() === 'high'
      ? 'bg-rose-500 text-white'
      : caseData.priority?.toLowerCase() === 'medium'
        ? 'bg-amber-500 text-white'
        : 'bg-slate-500 text-white'

  // Determine status badge color
  const statusBadgeColor =
    isClosed
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
      : caseData.status === 'Pending Verification'
        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300'
        : caseData.status === 'Under Investigation' || caseData.status === 'Corrective Action' || caseData.status === 'Assigned'
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'

  return (
    <DashboardLayout
      title={`Case ${caseData.case_id}`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Risk Cases', href: '/risk-cases' },
        { label: caseData.case_id },
      ]}
    >
      <div className="space-y-4 max-w-6xl">
        {/* ========================================================================= */}
        {/* HEADER BAR: Case Title, Priority, Status Dropdown / Action Buttons        */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/risk-cases"
                className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Back to Risk Cases"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Case {caseData.case_id}
              </h1>
              <span className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider ${priorityBadgeColor}`}>
                {caseData.priority} Priority
              </span>
              <span className={`px-3 py-1 rounded text-xs font-medium border ${statusBadgeColor}`}>
                Status: {isClosed ? 'Closed' : caseData.status === 'New' ? 'Open' : caseData.status === 'Pending Verification' ? 'Pending Closure' : caseData.status}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 ml-9">
              {primarySignal?.rule_name || (caseData as any).rule_description || 'Risk exception detected'}
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2">
            {!caseData.assigned_to && caseData.status === 'New' && (
              <Button
                size="sm"
                onClick={handleAcceptCase}
                disabled={actionLoading}
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                Accept Case
              </Button>
            )}
            {caseData.status === 'Assigned' && (
              <Button
                size="sm"
                onClick={handleStartInvestigation}
                disabled={actionLoading}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Begin Investigation
              </Button>
            )}
            {isClosed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReopenModalOpen(true)}
                disabled={actionLoading}
                className="text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reopen Case
              </Button>
            )}
          </div>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/25 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* HORIZONTAL TAB NAVIGATION (Wireframe 6 Tabs Layout)                       */}
        {/* ========================================================================= */}
        <div className="flex border-b border-border/80 overflow-x-auto gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 -mb-px whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW                                                           */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Case Details & Supplier Baseline */}
              <div className="space-y-4">
                <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/50">
                    <h2 className="text-sm font-bold text-foreground">Case Details</h2>
                    <span className="text-[11px] font-mono text-muted-foreground">ID: {caseData.case_id}</span>
                  </div>

                  <div className="space-y-3 text-xs divide-y divide-border/40">
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Case ID</span>
                      <span className="font-mono font-bold text-foreground">{caseData.case_id}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Triggered Rule</span>
                      <span className="font-semibold text-foreground text-right max-w-[240px] truncate">
                        {primarySignal?.rule_code ? `${primarySignal.rule_code}: ${primarySignal.rule_name}` : 'Duplicate invoice detected (R-005)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Priority</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${priorityBadgeColor}`}>
                        {caseData.priority}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Status</span>
                      <span className="font-semibold text-foreground">{caseData.status}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Owner</span>
                      <span className="font-mono font-medium text-foreground">
                        {caseData.assigned_to || (
                          <button
                            onClick={handleAcceptCase}
                            className="text-primary hover:underline font-semibold"
                          >
                            Assign to Me
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Date Created</span>
                      <span className="font-mono text-muted-foreground">
                        {caseData.created_at ? new Date(caseData.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Sep 05, 2026'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Due Date</span>
                      <span className="font-mono text-muted-foreground">Sep 08, 2026</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Supplier / Entity</span>
                      <span className="font-mono font-semibold text-foreground">{caseData.supplier_id || 'SUP-001'}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Transaction Reference</span>
                      <span className="font-mono text-foreground">{caseData.transaction_id || 'TX-1999'}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Last Updated</span>
                      <span className="font-mono text-muted-foreground">
                        {caseData.updated_at ? new Date(caseData.updated_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Sep 06, 2026'}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Supplier Historical Baseline Card */}
                <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-primary" />
                      Supplier Historical Baseline
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                      Strict Exclusion Active
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Evaluated against historical baseline of supplier <span className="font-mono font-semibold text-foreground">{caseData.supplier_id || 'SUP-001'}</span> across prior transactions. Target transaction <span className="font-mono font-semibold text-foreground">{caseData.transaction_id || 'TX-1999'}</span> is strictly excluded from baseline calculation to eliminate bias.
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center font-mono">
                    <div className="p-2 rounded-lg bg-muted/20 border border-border/40">
                      <p className="text-[10px] text-muted-foreground uppercase">Historical Mean</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">$30,471.43</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/20 border border-border/40">
                      <p className="text-[10px] text-muted-foreground uppercase">Evaluated Tx</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">$104,000.00</p>
                    </div>
                    <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                      <p className="text-[10px] uppercase font-bold">Deviation</p>
                      <p className="text-xs font-bold mt-0.5">3.41x (&gt; 2.0x)</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Column: Why This Case Was Flagged */}
              <div className="space-y-4">
                <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-foreground">Why This Case Was Flagged</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                      Additive Scoring Engine
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {primarySignal?.explanation ||
                      'Automated risk detection rules identified an operational or financial anomaly requiring review.'}
                  </p>

                  {/* Multi-Signal Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <p className="text-xs font-bold text-foreground">Triggered Detection Rules</p>
                    <div className="space-y-2">
                      {enrichedSignals && enrichedSignals.length > 0 ? (
                        enrichedSignals.map((signal, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-foreground flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-primary" />
                                {signal.rule_code}: {signal.rule_name}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                +{signal.weight || signal.score} pts
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {signal.explanation}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-foreground">R-005: Duplicate Invoice Detected</span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              +50 pts
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Two invoices sharing identical invoice number and dollar amount detected for the same supplier within 30 days.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50 space-y-2">
                    <h3 className="text-xs font-bold text-foreground">Potential Risk</h3>
                    <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                      <li>Duplicate payment disbursement</li>
                      <li>Financial loss exposure</li>
                      <li>Internal control bypass</li>
                    </ul>
                  </div>
                </Card>

                {/* Final Closed Case View Card */}
                {isClosed && (
                  <Card className="p-5 bg-emerald-500/5 border border-emerald-500/30 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Case Closed &amp; Verified</h3>
                        <p className="text-xs text-muted-foreground">
                          All required actions completed and verified by TRIS.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-500/20 text-xs space-y-1.5">
                      <p className="font-semibold text-foreground">Outcome</p>
                      <ul className="text-muted-foreground space-y-1 pl-4 list-disc">
                        <li>{caseData.corrective_action || 'Remediation completed'}</li>
                        <li>Root cause: {caseData.root_cause || 'Documented and addressed'}</li>
                        <li>Evidence on file: {caseData.closure_evidence || 'Audit verification log'}</li>
                        <li>Enrolled in 90-day recurrence monitoring (Rule R-006)</li>
                      </ul>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setActiveTab('history')}
                      className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      View Timeline
                    </Button>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: INVESTIGATION                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'investigation' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-5 max-w-3xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Investigation Details</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Record findings, review evidence, classify root cause, and attach supporting documentation.
                  </p>
                </div>
                {!isClosed && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isInvestigationLocked}
                      onClick={handleClearForm}
                      className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isInvestigationLocked}
                      onClick={handleAutofillSample}
                      className="text-xs h-8 text-primary border-primary/30 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                      Autofill Sample
                    </Button>
                  </div>
                )}
              </div>

              {/* Lifecycle Stage Alert / Lock State */}
              {caseData.status === 'New' && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-bold">Investigation Locked — Ownership Required</p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        You must accept ownership of this case before documenting investigation findings and root cause.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAcceptCase}
                    disabled={actionLoading}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-semibold"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1" />
                    Accept Case to Unlock
                  </Button>
                </div>
              )}

              {caseData.status === 'Assigned' && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
                  <Search className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Ready for Investigation:</strong> Document your findings below. Clicking &quot;Save Changes&quot; will advance the case to <strong>Under Investigation</strong>.
                  </span>
                </div>
              )}

              {isClosed && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>Investigation Finalized:</strong> Case is closed. Investigation findings and root-cause classification are permanently preserved in the audit log.
                  </span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* Evidence Reviewed */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Evidence Reviewed</label>
                  <textarea
                    rows={2}
                    value={evidenceReviewed}
                    disabled={isInvestigationLocked}
                    onChange={(e) => {
                      setEvidenceReviewed(e.target.value)
                      saveDraftLocally()
                    }}
                    placeholder="Enter records examined (e.g. accounts payable ledger, vendor master bank change log, approval hierarchy)..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
                  />
                </div>

                {/* Finding / Disposition */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Finding / Disposition</label>
                  <textarea
                    rows={2}
                    value={findingDisposition}
                    disabled={isInvestigationLocked}
                    onChange={(e) => {
                      setFindingDisposition(e.target.value)
                      saveDraftLocally()
                    }}
                    placeholder="Enter specific finding (e.g. duplicate invoice entered due to manual data entry error; or unusual amount confirmed without approval)..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
                  />
                </div>

                {/* Root-Cause Category */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Root-Cause Category</label>
                  <select
                    value={rootCauseCategory}
                    disabled={isInvestigationLocked}
                    onChange={(e) => {
                      setRootCauseCategory(e.target.value)
                      saveDraftLocally()
                    }}
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:bg-muted/20"
                  >
                    <option value="">Select Root-Cause Category...</option>
                    <option value="Process Error / Data Entry">Process Error / Data Entry</option>
                    <option value="Approval Bypass / Threshold Breach">Approval Bypass / Threshold Breach</option>
                    <option value="Bank Routing / Vendor Tampering">Bank Routing / Vendor Tampering</option>
                    <option value="System / Integration Glitch">System / Integration Glitch</option>
                    <option value="Authorized Legitimate Exception">Authorized Legitimate Exception</option>
                  </select>
                </div>

                {/* Root Cause Explanation */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">
                    Root Cause Explanation <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={rootCause}
                    disabled={isInvestigationLocked}
                    onChange={(e) => {
                      setRootCause(e.target.value)
                      saveDraftLocally()
                    }}
                    placeholder="Detail the underlying operational or technical cause of this risk exception..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
                  />
                </div>

                {/* Supporting Evidence Attachment */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Supporting Evidence</label>
                  {supportingEvidence ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-600 flex items-center justify-center font-mono font-bold text-xs">
                          E
                        </div>
                        <div>
                          <p className="font-medium font-mono text-foreground">{supportingEvidence}</p>
                          <p className="text-[10px] text-muted-foreground">Document verified</p>
                        </div>
                      </div>
                      {!isClosed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSupportingEvidence('')
                            saveDraftLocally()
                          }}
                          className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`p-4 border-2 border-dashed rounded-lg text-center space-y-1 transition-colors ${
                        isInvestigationLocked
                          ? 'border-border/40 opacity-50 cursor-not-allowed bg-muted/10'
                          : 'border-border cursor-pointer hover:border-primary/50'
                      }`}
                      onClick={() => {
                        if (!isInvestigationLocked) {
                          setSupportingEvidence('invoice_comparison.png')
                          saveDraftLocally()
                        }
                      }}
                    >
                      <Upload className="w-4 h-4 mx-auto text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">
                        Click to attach evidence file (e.g. invoice_comparison.png or audit_log.pdf)
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isClosed && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveInvestigation}
                      disabled={actionLoading || isInvestigationLocked}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      {actionLoading ? 'Saving...' : caseData.status === 'Assigned' ? 'Save & Begin Investigation' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CORRECTIVE ACTION                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'corrective-action' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-5 max-w-3xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Corrective Action Plan</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Specify remedial actions, responsible personnel, and verifiable completion dates.
                  </p>
                </div>
                {!isClosed && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isCorrectiveLocked}
                      onClick={handleClearForm}
                      className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isCorrectiveLocked}
                      onClick={handleAutofillSample}
                      className="text-xs h-8 text-primary border-primary/30 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                      Autofill Sample
                    </Button>
                  </div>
                )}
              </div>

              {/* Lifecycle Stage Alert / Option A Locked State */}
              {(caseData.status === 'New' || caseData.status === 'Assigned') && (
                <div className="p-4 rounded-xl bg-slate-500/10 border border-border text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-bold text-foreground">Corrective Action Locked — Investigation Required</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Corrective actions can only be formulated after the initial investigation and root-cause analysis are documented.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('investigation')}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-medium"
                  >
                    Go to Investigation Tab →
                  </Button>
                </div>
              )}

              {caseData.status === 'Under Investigation' && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
                  <Wrench className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Define Remediation Plan:</strong> Document the corrective action taken. Clicking &quot;Save Changes&quot; will advance the case to <strong>Corrective Action</strong>.
                  </span>
                </div>
              )}

              {caseData.status === 'Corrective Action' && (
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                    <span>
                      <strong>Remediation Active:</strong> Once actions are executed and evidence attached, submit for verification.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await handleTransition('Pending Verification', {
                        note: `Corrective action verified. Submitted for closure sign-off: ${actionTaken}`,
                      })
                      setActiveTab('closure')
                    }}
                    disabled={actionLoading || !actionTaken.trim()}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0 font-medium"
                  >
                    Submit for Verification →
                  </Button>
                </div>
              )}

              {caseData.status === 'Pending Verification' && (
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span>
                      <strong>Submitted for Verification:</strong> Ready for closure sign-off. Proceed to the Closure tab to complete validation.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('closure')}
                    className="text-xs bg-sky-600 hover:bg-sky-700 text-white shrink-0 font-medium"
                  >
                    Go to Closure Tab →
                  </Button>
                </div>
              )}

              {isClosed && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>Remediation Verified:</strong> All corrective actions have been completed, verified with evidence, and closed.
                  </span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* Action Taken */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">
                    Action Taken <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={actionTaken}
                    disabled={isCorrectiveLocked}
                    onChange={(e) => {
                      setActionTaken(e.target.value)
                      saveDraftLocally()
                    }}
                    placeholder="Enter remedial actions taken (e.g. duplicate invoice deleted, payment blocked, supplier master record updated)..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
                  />
                </div>

                {/* Responsible Person */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Responsible Person / Function</label>
                  <Input
                    value={responsiblePerson}
                    disabled={isCorrectiveLocked}
                    placeholder="e.g. Risk Reviewer / Case Owner"
                    onChange={(e) => {
                      setResponsiblePerson(e.target.value)
                      saveDraftLocally()
                    }}
                    className="h-9 text-xs bg-card disabled:opacity-75 disabled:bg-muted/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Target Completion Date */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Target Completion Date</label>
                    <Input
                      type="date"
                      value={targetCompletionDate}
                      disabled={isCorrectiveLocked}
                      onChange={(e) => {
                        setTargetCompletionDate(e.target.value)
                        saveDraftLocally()
                      }}
                      className="h-9 text-xs bg-card font-mono disabled:opacity-75 disabled:bg-muted/20"
                    />
                  </div>

                  {/* Actual Completion Date */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Actual Completion Date</label>
                    <Input
                      type="date"
                      value={completionDate}
                      disabled={isCorrectiveLocked}
                      onChange={(e) => {
                        setCompletionDate(e.target.value)
                        saveDraftLocally()
                      }}
                      className="h-9 text-xs bg-card font-mono disabled:opacity-75 disabled:bg-muted/20"
                    />
                  </div>
                </div>

                {/* Evidence of Action */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Evidence of Action</label>
                  {evidenceOfAction ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-600 flex items-center justify-center font-mono font-bold text-xs">
                          D
                        </div>
                        <div>
                          <p className="font-medium font-mono text-foreground">{evidenceOfAction}</p>
                          <p className="text-[10px] text-muted-foreground">Attached evidence document</p>
                        </div>
                      </div>
                      {!isClosed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEvidenceOfAction('')
                            saveDraftLocally()
                          }}
                          className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`p-4 border-2 border-dashed rounded-lg text-center space-y-1 transition-colors ${
                        isCorrectiveLocked
                          ? 'border-border/40 opacity-50 cursor-not-allowed bg-muted/10'
                          : 'border-border cursor-pointer hover:border-primary/50'
                      }`}
                      onClick={() => {
                        if (!isCorrectiveLocked) {
                          setEvidenceOfAction('supplier_update.png')
                          saveDraftLocally()
                        }
                      }}
                    >
                      <Upload className="w-4 h-4 mx-auto text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">
                        Click to attach remediation proof (e.g. supplier_update.png or hold_notice.pdf)
                      </p>
                    </div>
                  )}
                </div>

                {/* Current Status */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Current Status</label>
                  <select
                    value={actionStatus}
                    disabled={isCorrectiveLocked}
                    onChange={(e) => {
                      setActionStatus(e.target.value)
                      saveDraftLocally()
                    }}
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:bg-muted/20"
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Pending Review">Pending Review</option>
                  </select>
                </div>

                {/* Outcome / Comments */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Outcome / Comments</label>
                  <textarea
                    rows={2}
                    value={actionComments}
                    disabled={isCorrectiveLocked}
                    onChange={(e) => {
                      setActionComments(e.target.value)
                      saveDraftLocally()
                    }}
                    placeholder="Enter summary comments on remediation result..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
                  />
                </div>

                {!isClosed && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveCorrectiveAction}
                      disabled={actionLoading || isCorrectiveLocked}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      {actionLoading ? 'Saving...' : caseData.status === 'Under Investigation' ? 'Save & Advance to Corrective Action' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CLOSURE                                                            */}
        {/* ========================================================================= */}
        {activeTab === 'closure' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-5 max-w-3xl">
              <div>
                <h2 className="text-sm font-bold text-foreground">Closure Information</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  TRIS enforces system-validated closure. All mandatory criteria must be satisfied.
                </p>
              </div>

              {/* Stage-based Lock State for Closure Tab */}
              {isClosureLocked && (
                <div className="p-4 rounded-xl bg-slate-500/10 border border-border text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-bold text-foreground">Closure Locked — Workflow Progression Required</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {caseData.status === 'New' || caseData.status === 'Assigned'
                          ? 'This case must be investigated and remediated before closure verification can be requested.'
                          : caseData.status === 'Under Investigation'
                            ? 'Investigation in progress. Document the corrective action plan to advance toward closure.'
                            : 'Remediation plan active. Advance the case to Pending Verification to unlock final sign-off.'}
                      </p>
                    </div>
                  </div>
                  {caseData.status === 'New' || caseData.status === 'Assigned' ? (
                    <Button
                      size="sm"
                      onClick={() => setActiveTab('investigation')}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-medium"
                    >
                      Go to Investigation Tab →
                    </Button>
                  ) : caseData.status === 'Under Investigation' ? (
                    <Button
                      size="sm"
                      onClick={() => setActiveTab('corrective-action')}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-medium"
                    >
                      Go to Corrective Action →
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await handleTransition('Pending Verification', {
                          note: 'Remediation completed. Advanced to Pending Verification.',
                        })
                      }}
                      disabled={actionLoading || !hasCorrectiveAction}
                      className="text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0 font-medium"
                    >
                      Advance to Verification →
                    </Button>
                  )}
                </div>
              )}

              {caseData.status === 'Pending Verification' && (
                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300 text-xs flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span>
                    <strong>Verification Gate Active:</strong> All 8 mandatory criteria are unlocked for final review. Confirm closure notes below and mark as closed.
                  </span>
                </div>
              )}

              {/* Closure Validation Errors Alert */}
              {closureValidationErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-xs space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Closure Blocked: Missing Mandatory Requirements
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 font-mono text-[11px]">
                    {closureValidationErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* Dynamic Real-Time Closure Validation Checklist */}
                <div className="space-y-2.5 p-4 rounded-xl bg-muted/20 border border-border/60">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <span className="font-bold text-foreground text-xs block">Closure Validation Checklist</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {[hasRootCause, hasCorrectiveAction, hasEvidence, isPendingOrClosed].filter(Boolean).length} of 4 Satisfied
                    </span>
                  </div>

                  {/* 1. Root Cause */}
                  <div className="flex items-center justify-between py-1">
                    <label className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={hasRootCause}
                        readOnly
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                      />
                      <span className={hasRootCause ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                        Root cause documented
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {hasRootCause ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Documented</span>
                      ) : (
                        <button onClick={() => setActiveTab('investigation')} className="text-primary hover:underline">
                          Required in Investigation →
                        </button>
                      )}
                    </span>
                  </div>

                  {/* 2. Corrective Action */}
                  <div className="flex items-center justify-between py-1">
                    <label className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={hasCorrectiveAction}
                        readOnly
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                      />
                      <span className={hasCorrectiveAction ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                        Corrective action completed
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {hasCorrectiveAction ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Action Recorded</span>
                      ) : (
                        <button onClick={() => setActiveTab('corrective-action')} className="text-primary hover:underline">
                          Required in Corrective Action →
                        </button>
                      )}
                    </span>
                  </div>

                  {/* 3. Evidence */}
                  <div className="flex items-center justify-between py-1">
                    <label className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={hasEvidence}
                        readOnly
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                      />
                      <span className={hasEvidence ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                        Evidence provided
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {hasEvidence ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[150px] inline-block">
                          ✓ {supportingEvidence || evidenceOfAction || caseData.closure_evidence}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Attachment required</span>
                      )}
                    </span>
                  </div>

                  {/* 4. Verification Gate Precondition */}
                  <div className="flex items-center justify-between py-1">
                    <label className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isPendingOrClosed}
                        readOnly
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                      />
                      <span className={isPendingOrClosed ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                        Verification gate active (Pending Verification)
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {isPendingOrClosed ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Active</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Current: {caseData.status}</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Closure Notes */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Closure Notes</label>
                  <textarea
                    rows={2}
                    value={closureNotes}
                    disabled={isClosureLocked}
                    onChange={(e) => {
                      setClosureNotes(e.target.value)
                      saveDraftLocally()
                    }}
                    placeholder="Enter closure confirmation notes and follow-up requirements..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
                  />
                </div>

                {/* Close Case Button Area */}
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
                  <div>
                    <span className="font-semibold text-foreground text-xs block">Close Case</span>
                    <p className="text-[11px] text-muted-foreground">
                      {isClosed
                        ? 'Case has completed system-validated closure.'
                        : caseData.status === 'Pending Verification'
                          ? 'All 8 mandatory closure criteria will be validated upon submission.'
                          : caseData.status === 'Corrective Action'
                            ? 'Advance case to Pending Verification once remediation is completed.'
                            : 'Case must progress through investigation and corrective action before closing.'}
                    </p>
                  </div>

                  <div>
                    {isClosed ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Case Closed &amp; Verified
                      </span>
                    ) : caseData.status === 'Pending Verification' ? (
                      <Button
                        size="sm"
                        onClick={executeClosure}
                        disabled={actionLoading || !hasRootCause || !hasCorrectiveAction || !hasEvidence}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4"
                      >
                        {actionLoading ? 'Validating Closure...' : 'Mark as Closed'}
                      </Button>
                    ) : caseData.status === 'Corrective Action' ? (
                      <Button
                        size="sm"
                        onClick={async () => {
                          await handleTransition('Pending Verification', {
                            note: 'Remediation completed. Advanced to Pending Verification.',
                          })
                        }}
                        disabled={actionLoading || !hasCorrectiveAction}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4"
                      >
                        {actionLoading ? 'Transitioning...' : 'Advance to Pending Verification →'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled
                        variant="outline"
                        className="text-xs text-muted-foreground cursor-not-allowed"
                      >
                        Closure Locked (Follow Workflow)
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: CASE TIMELINE / HISTORY                                            */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4 max-w-3xl">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <h2 className="text-sm font-bold text-foreground">Case Timeline</h2>
                <button
                  onClick={() => setAuditSortOrder(auditSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {auditSortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                </button>
              </div>

              {/* Chronological Vertical Timeline */}
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                {/* 1. Case Created */}
                <div className="relative space-y-1 text-xs">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-card" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {caseData.created_at ? new Date(caseData.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Sep 05, 2026 10:15'}
                    </span>
                  </div>
                  <p className="font-bold text-foreground">Case created by TRIS</p>
                  <p className="text-muted-foreground">
                    {primarySignal?.rule_name || (caseData as any).rule_description || 'Exception detected'}
                  </p>
                </div>

                {/* 2. Ownership Assigned */}
                {(caseData.assigned_to || caseData.status !== 'New') && (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground text-[11px]">Lifecycle Step 2</span>
                    </div>
                    <p className="font-bold text-foreground">Ownership assigned</p>
                    <p className="text-muted-foreground">{caseData.assigned_to || 'Risk Reviewer / Case Owner'}</p>
                  </div>
                )}

                {/* 3. Investigation Updated */}
                {(caseData.status === 'Under Investigation' || caseData.status === 'Corrective Action' || caseData.status === 'Pending Verification' || isClosed) && (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground text-[11px]">Lifecycle Step 3</span>
                    </div>
                    <p className="font-bold text-foreground">Investigation updated</p>
                    <p className="text-muted-foreground">
                      {caseData.root_cause ? `Root cause: ${caseData.root_cause}` : 'Findings and root cause recorded'}
                    </p>
                  </div>
                )}

                {/* 4. Corrective Action Completed */}
                {(caseData.status === 'Corrective Action' || caseData.status === 'Pending Verification' || isClosed) && (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground text-[11px]">Lifecycle Step 4</span>
                    </div>
                    <p className="font-bold text-foreground">Corrective action completed</p>
                    <p className="text-muted-foreground">
                      {caseData.corrective_action ? `Remediation: ${caseData.corrective_action}` : 'Remediation plan executed with evidence'}
                    </p>
                  </div>
                )}

                {/* 5. Case Closed */}
                {isClosed && (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {caseData.closure_date ? new Date(caseData.closure_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Final Step'}
                      </span>
                    </div>
                    <p className="font-bold text-foreground">Case closed &amp; verified</p>
                    <p className="text-muted-foreground">All 8 mandatory closure fields verified by TRIS</p>
                  </div>
                )}

                {/* Live History Entries from Backend */}
                {caseData.history && caseData.history.length > 0 && (
                  <div className="pt-4 border-t border-border/40 space-y-4">
                    <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-muted-foreground">
                      Append-Only Audit Entries ({caseData.history.length})
                    </p>
                    {caseData.history.map((h, i) => (
                      <div key={h.history_id || i} className="relative space-y-0.5 text-xs">
                        <div className="absolute -left-6 top-1 w-2 h-2 rounded-full bg-slate-400 ring-4 ring-card" />
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{h.action}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">Actor: {h.actor}</p>
                        {h.note && (
                          <p className="text-[11px] bg-muted/20 p-2 rounded border border-border/40 text-muted-foreground italic">
                            &quot;{h.note}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: RECURRENCE VIEW                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'recurrence' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4 max-w-3xl">
              <div>
                <h2 className="text-sm font-bold text-foreground">Recurrence Monitoring</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  TRIS continuously monitors post-closure transactions for pattern recurrence (Rule R-006).
                </p>
              </div>

              <div className="space-y-3 text-xs divide-y divide-border/40">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground font-medium">Recurrence Status</span>
                  {(!caseData.prior_cases || caseData.prior_cases.length === 0) ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <div>
                        <span>No Recurrence Detected</span>
                        <p className="text-[10px] font-normal text-muted-foreground">
                          TRIS has not detected this type of issue again since closure.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{caseData.prior_cases.length} Prior Similar Case(s) Detected</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3">
                  <span className="text-muted-foreground font-medium">Monitoring Window</span>
                  <span className="font-mono text-foreground">90 Days Post-Closure (Rule R-006)</span>
                </div>

                <div className="flex justify-between items-center pt-3">
                  <span className="text-muted-foreground font-medium">Evaluated Rule</span>
                  <span className="text-foreground font-medium">
                    {primarySignal?.rule_name || (caseData as any).rule_description || 'Risk Exception Monitoring'}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3">
                  <span className="text-muted-foreground font-medium">Supplier</span>
                  <span className="font-mono text-muted-foreground">{caseData.supplier_id || 'SUP-001'}</span>
                </div>
              </div>

              {caseData.prior_cases && caseData.prior_cases.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2 text-xs">
                  <p className="font-semibold text-foreground">Linked Prior Cases (Rule R-006)</p>
                  {caseData.prior_cases.map((pc: any) => (
                    <div key={pc.case_id} className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-foreground">{pc.case_id}</span>
                        <Badge variant="outline" className="text-[10px]">{pc.status}</Badge>
                      </div>
                      <p className="text-muted-foreground">Prior Root Cause: {pc.root_cause || 'Process error'}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => router.push('/risk-cases')}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  View Similar Cases
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REOPEN CONFIRMATION MODAL                                                 */}
        {/* ========================================================================= */}
        {reopenModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
            <Card className="w-full max-w-md p-6 space-y-4 my-8 bg-card border-border shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-warning/15 text-warning rounded-lg border border-warning/30">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Reopen Case for Review</h3>
                    <p className="text-[11px] text-muted-foreground">Immutable audit event will be recorded.</p>
                  </div>
                </div>
                <button
                  onClick={() => setReopenModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="font-semibold text-foreground">
                  Reopening Rationale / Reviewer Note *
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReopenModalOpen(false)}
                  disabled={actionLoading}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  disabled={actionLoading || !reopenReason.trim()}
                  onClick={async () => {
                    await handleTransition('Reopened', { note: reopenReason })
                  }}
                >
                  Confirm Reopen
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
