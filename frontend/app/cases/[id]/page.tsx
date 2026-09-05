'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, RiskCase, CaseTransitionPayload, enrichSignal } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
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

  // Investigation form state
  const [investigationNotes, setInvestigationNotes] = useState(
    'Reviewed both invoices and related master records in the system. Verified posting dates, approval hierarchies, and vendor master changes.'
  )
  const [evidenceReviewed, setEvidenceReviewed] = useState(
    'Accounts payable invoice record, vendor master bank change audit log, approval threshold policy, and off-hours ERP access logs.'
  )
  const [findingDisposition, setFindingDisposition] = useState(
    'Unusual transaction amount confirmed; invoice lacked required Tier-2 authorization following recent vendor bank routing update.'
  )
  const [rootCauseCategory, setRootCauseCategory] = useState('Process Error / Data Entry')
  const [rootCause, setRootCause] = useState(
    'Duplicate invoice was entered due to manual data entry error.'
  )
  const [supportingEvidence, setSupportingEvidence] = useState('invoice_comparison.png')

  // Corrective action form state
  const [actionTaken, setActionTaken] = useState(
    'Duplicate invoice removed. Payment blocked. Supplier account reviewed.'
  )
  const [responsiblePerson, setResponsiblePerson] = useState('Risk Reviewer / Case Owner')
  const [targetCompletionDate, setTargetCompletionDate] = useState('2026-09-08')
  const [completionDate, setCompletionDate] = useState('2026-09-06')
  const [evidenceOfAction, setEvidenceOfAction] = useState('supplier_update.png')
  const [actionStatus, setActionStatus] = useState('Completed')
  const [actionComments, setActionComments] = useState(
    'Duplicate invoice deleted. Confirmed with supplier. No payment made.'
  )

  // Closure state & checklist
  const [closureNotes, setClosureNotes] = useState(
    'All required actions completed. Evidence verified. Case ready for closure.'
  )
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

      // Initialize form values from case data if present
      if (data.root_cause) setRootCause(data.root_cause)
      if (data.corrective_action) setActionTaken(data.corrective_action)
      if (data.closure_evidence) setSupportingEvidence(data.closure_evidence)
      if (data.assigned_to) setResponsiblePerson(data.assigned_to)
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
      setSuccessMessage(`Case transitioned to ${toStatus} successfully.`)
      setClosureModalOpen(false)
      setReopenModalOpen(false)
    } catch (err: any) {
      setError(err.message || `Failed to transition case to ${toStatus}`)
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
    try {
      if (caseData?.status === 'Assigned') {
        await handleTransition('Under Investigation', {
          note: `Investigation saved. Root cause: ${rootCause} [Category: ${rootCauseCategory}]`,
        })
      } else {
        setSuccessMessage('Investigation details saved successfully.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save investigation')
    } finally {
      setActionLoading(false)
    }
  }

  // Save Corrective Action
  const handleSaveCorrectiveAction = async () => {
    setActionLoading(true)
    setSuccessMessage(null)
    try {
      if (caseData?.status === 'Under Investigation') {
        await handleTransition('Corrective Action', {
          note: `Corrective action recorded: ${actionTaken} | Responsible: ${responsiblePerson}`,
        })
      } else {
        setSuccessMessage('Corrective action plan saved successfully.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save corrective action')
    } finally {
      setActionLoading(false)
    }
  }

  // Validate Closure Checklist
  const executeClosure = async () => {
    setClosureValidationErrors([])
    setError(null)

    // Build the 8 mandatory closure fields
    const payload = {
      root_cause: rootCause.trim() || caseData?.root_cause || '',
      corrective_action: actionTaken.trim() || caseData?.corrective_action || '',
      closure_type: closureForm.closure_type || 'Process Error / Remedied',
      closure_evidence: (supportingEvidence.trim() || evidenceOfAction.trim()) || caseData?.closure_evidence || '',
      verified_by: user?.name || 'Risk Reviewer / Case Owner',
      closure_date: new Date().toISOString().split('T')[0],
      follow_up_requirement: closureForm.follow_up_requirement || 'Periodic invoice audit',
      recurrence_monitoring: 'Enrolled in 90-day monitoring under Rule R-006',
    }

    // Verify all 8 fields are non-empty
    const missing: string[] = []
    if (!payload.root_cause) missing.push('Root cause documented')
    if (!payload.corrective_action) missing.push('Corrective action completed')
    if (!payload.closure_evidence) missing.push('Evidence provided')
    if (!payload.verified_by) missing.push('Verified by (Reviewer identity)')
    if (!payload.closure_date) missing.push('Closure date')
    if (!payload.follow_up_requirement) missing.push('Follow-up requirement')
    if (!payload.recurrence_monitoring) missing.push('Recurrence monitoring')

    if (missing.length > 0) {
      setClosureValidationErrors(missing)
      setError(`Closure blocked: missing mandatory fields [${missing.join(', ')}]`)
      return
    }

    // Attempt transition through Pending Verification to Closed
    try {
      setActionLoading(true)
      if (caseData?.status !== 'Pending Verification' && caseData?.status !== 'Closed') {
        await api.transitionCase(caseId, {
          to_status: 'Pending Verification',
          actor: user?.name || 'Risk Reviewer / Case Owner',
          note: 'Submitted for system-validated closure',
        })
      }
      const closed = await api.transitionCase(caseId, {
        to_status: 'Closed',
        actor: user?.name || 'Risk Reviewer / Case Owner',
        note: 'System-validated closure completed',
        ...payload,
      })
      setCaseData(closed)
      setSuccessMessage('Case successfully closed and verified by TRIS.')
    } catch (err: any) {
      setError(err.message || 'System-validated closure failed')
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

  const enrichedSignals = (caseData.trigger_signals || []).map((s) => enrichSignal(s))
  const primarySignal = enrichedSignals[0]
  const isClosed = caseData.status === 'Closed'

  // Determine priority color
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
        {/* HEADER BAR: Case Title, Subtitle, Priority, Status Dropdown / Buttons */}
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
                Status: {isClosed ? 'Closed' : caseData.status === 'New' ? 'Open' : caseData.status === 'Pending Verification' ? 'Pending Closure' : 'In Progress'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 ml-9">
              {primarySignal?.rule_name || (caseData as any).rule_description || 'Duplicate invoice detected'}
            </p>
          </div>

          {/* Quick Actions */}
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
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
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
        {/* HORIZONTAL TAB NAVIGATION (Wireframe layout) */}
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
        {/* TAB 1: OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Case Summary */}
              <div className="space-y-4">
                <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4">
                  <h2 className="text-sm font-bold text-foreground">Case Summary</h2>

                  <div className="space-y-2.5 text-xs divide-y divide-border/40">
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-muted-foreground font-medium">Case ID</span>
                      <span className="font-mono font-bold text-foreground">{caseData.case_id}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Rule</span>
                      <span className="text-foreground font-medium text-right">
                        {primarySignal?.rule_name || (caseData as any).rule_description || 'Duplicate invoice detected'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Priority</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${priorityBadgeColor}`}>
                        {caseData.priority}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Status</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusBadgeColor}`}>
                        {isClosed ? 'Closed' : caseData.status === 'New' ? 'Open' : caseData.status === 'Pending Verification' ? 'Pending Closure' : 'In Progress'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-muted-foreground font-medium">Owner</span>
                      <span className="text-foreground font-medium">
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

                {/* Supplier Historical Baseline Card (Image 1 Requirement) */}
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
                      'Two invoices with the same invoice number and amount were detected for the same supplier within a short time period.'}
                  </p>

                  {/* Multi-Signal Breakdown (Image 2 & 3: R-001 to R-004 breakdown) */}
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

                {/* Final Closed Case View Card (Screen 9) */}
                {isClosed && (
                  <Card className="p-5 bg-emerald-500/5 border border-emerald-500/30 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Case Closed</h3>
                        <p className="text-xs text-muted-foreground">
                          All required actions completed and verified. This case is now closed.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-500/20 text-xs space-y-1.5">
                      <p className="font-semibold text-foreground">Outcome</p>
                      <ul className="text-muted-foreground space-y-1 pl-4 list-disc">
                        <li>Duplicate invoice removed</li>
                        <li>Payment blocked</li>
                        <li>Supplier account reviewed</li>
                        <li>No recurrence detected to date</li>
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
        {/* TAB 2: INVESTIGATION */}
        {/* ========================================================================= */}
        {activeTab === 'investigation' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-5 max-w-3xl">
              <div>
                <h2 className="text-sm font-bold text-foreground">Investigation Details</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record findings, review evidence, classify root cause, and attach supporting documentation.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Evidence Reviewed */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Evidence Reviewed</label>
                  <textarea
                    rows={2}
                    value={evidenceReviewed}
                    onChange={(e) => setEvidenceReviewed(e.target.value)}
                    placeholder="Accounts payable invoice record, vendor master bank change audit log..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                {/* Finding / Disposition */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Finding / Disposition</label>
                  <textarea
                    rows={2}
                    value={findingDisposition}
                    onChange={(e) => setFindingDisposition(e.target.value)}
                    placeholder="Document forensic findings and disposition..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                {/* Root Cause Category */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Root-Cause Category</label>
                  <select
                    value={rootCauseCategory}
                    onChange={(e) => setRootCauseCategory(e.target.value)}
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Process Error / Data Entry">Process Error / Data Entry</option>
                    <option value="Internal Control Bypass">Internal Control Bypass</option>
                    <option value="Unauthorized Vendor Master Change">Unauthorized Vendor Master Change</option>
                    <option value="System Integration Glitch">System Integration Glitch</option>
                    <option value="Supplier Account Compromise">Supplier Account Compromise</option>
                  </select>
                </div>

                {/* Investigation Notes */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Investigation Notes</label>
                  <textarea
                    rows={3}
                    value={investigationNotes}
                    onChange={(e) => setInvestigationNotes(e.target.value)}
                    placeholder="Reviewed both invoices in the system..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                {/* Root Cause Notes */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Root Cause Explanation</label>
                  <textarea
                    rows={2}
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder="Enter identified root cause..."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                {/* Supporting Evidence File Preview */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Supporting Evidence</label>
                  {supportingEvidence ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-600 flex items-center justify-center font-mono font-bold text-xs">
                          D
                        </div>
                        <div>
                          <p className="font-medium font-mono text-foreground">{supportingEvidence}</p>
                          <p className="text-[10px] text-muted-foreground">Uploaded Sep 06, 2026</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSupportingEvidence('')}
                        className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-dashed border-border rounded-lg text-center space-y-1 cursor-pointer hover:border-primary/50"
                         onClick={() => setSupportingEvidence('invoice_comparison.png')}>
                      <Upload className="w-4 h-4 mx-auto text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">Click to attach evidence file (e.g. invoice_comparison.png)</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveInvestigation}
                    disabled={actionLoading}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CORRECTIVE ACTION */}
        {/* ========================================================================= */}
        {activeTab === 'corrective-action' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-5 max-w-3xl">
              <div>
                <h2 className="text-sm font-bold text-foreground">Corrective Action Plan</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Specify remedial actions, responsible personnel, and verifiable completion dates.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Action Taken */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Action Taken</label>
                  <textarea
                    rows={2}
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="Duplicate invoice removed. Payment blocked. Supplier account reviewed."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                {/* Responsible Person */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Responsible Person / Function</label>
                  <Input
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    className="h-9 text-xs bg-card"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Target Completion Date */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Target Completion Date</label>
                    <Input
                      type="date"
                      value={targetCompletionDate}
                      onChange={(e) => setTargetCompletionDate(e.target.value)}
                      className="h-9 text-xs bg-card font-mono"
                    />
                  </div>

                  {/* Actual Completion Date */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Actual Completion Date</label>
                    <Input
                      type="date"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      className="h-9 text-xs bg-card font-mono"
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
                          <p className="text-[10px] text-muted-foreground">Uploaded Sep 06, 2026</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEvidenceOfAction('')}
                        className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-dashed border-border rounded-lg text-center space-y-1 cursor-pointer hover:border-primary/50"
                         onClick={() => setEvidenceOfAction('supplier_update.png')}>
                      <Upload className="w-4 h-4 mx-auto text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">Click to attach evidence file (e.g. supplier_update.png)</p>
                    </div>
                  )}
                </div>

                {/* Current Status */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Current Status</label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value)}
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    onChange={(e) => setActionComments(e.target.value)}
                    placeholder="Duplicate invoice deleted. Confirmed with supplier. No payment made."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveCorrectiveAction}
                    disabled={actionLoading}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CLOSURE */}
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

              {/* Closure Validation Errors Alert (Wireframe Screen 6 / E2E-05) */}
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
                {/* Closure Validation Checkboxes (Screen 6) */}
                <div className="space-y-2.5 p-4 rounded-xl bg-muted/20 border border-border/60">
                  <span className="font-bold text-foreground text-xs block">Closure Validation</span>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!rootCause.trim()}
                      onChange={() => {}}
                      readOnly
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                    />
                    <span className={rootCause.trim() ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      Root cause documented
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!actionTaken.trim()}
                      onChange={() => {}}
                      readOnly
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                    />
                    <span className={actionTaken.trim() ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      Corrective action completed
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(supportingEvidence || evidenceOfAction)}
                      onChange={() => {}}
                      readOnly
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                    />
                    <span className={(supportingEvidence || evidenceOfAction) ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      Evidence provided
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {}}
                      readOnly
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                    />
                    <span className="text-foreground font-medium">
                      No further action required
                    </span>
                  </label>
                </div>

                {/* Closure Notes */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Closure Notes</label>
                  <textarea
                    rows={2}
                    value={closureNotes}
                    onChange={(e) => setClosureNotes(e.target.value)}
                    placeholder="All required actions completed. Evidence verified. Case ready for closure."
                    className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                {/* Close Case Button */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="font-semibold text-foreground">Close Case</span>
                  {isClosed ? (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 text-xs">
                      Case Closed &amp; Verified
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={executeClosure}
                      disabled={actionLoading}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4"
                    >
                      {actionLoading ? 'Validating Closure...' : 'Mark as Closed'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: CASE TIMELINE / HISTORY */}
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

              {/* Chronological Vertical Timeline (matching Wireframe Screen 7) */}
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                {/* 1. Case Created */}
                <div className="relative space-y-1 text-xs">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-card" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground text-[11px]">Sep 05, 2026 10:15</span>
                  </div>
                  <p className="font-bold text-foreground">Case created by TRIS</p>
                  <p className="text-muted-foreground">Duplicate invoice detected</p>
                </div>

                {/* 2. Ownership Assigned */}
                {(caseData.assigned_to || caseData.status !== 'New') && (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground text-[11px]">Sep 05, 2026 11:30</span>
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
                      <span className="font-mono text-muted-foreground text-[11px]">Sep 06, 2026 09:20</span>
                    </div>
                    <p className="font-bold text-foreground">Investigation updated</p>
                    <p className="text-muted-foreground">Root cause documented</p>
                  </div>
                )}

                {/* 4. Corrective Action Completed */}
                {(caseData.status === 'Corrective Action' || caseData.status === 'Pending Verification' || isClosed) && (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground text-[11px]">Sep 06, 2026 14:10</span>
                    </div>
                    <p className="font-bold text-foreground">Corrective action completed</p>
                    <p className="text-muted-foreground">Evidence provided</p>
                  </div>
                )}

                {/* 5. Case Closed */}
                {isClosed && (
                  <div className="relative space-y-1 text-xs">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground text-[11px]">Sep 06, 2026 16:00</span>
                    </div>
                    <p className="font-bold text-foreground">Case closed</p>
                    <p className="text-muted-foreground">System-validated closure</p>
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
        {/* TAB 6: RECURRENCE VIEW (Wireframe Screen 8) */}
        {/* ========================================================================= */}
        {activeTab === 'recurrence' && (
          <div className="space-y-6 pt-2">
            <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4 max-w-3xl">
              <div>
                <h2 className="text-sm font-bold text-foreground">Recurrence Monitoring</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  TRIS will monitor future data for similar issues.
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
                  <span className="text-muted-foreground font-medium">Monitoring Period</span>
                  <span className="font-mono text-foreground">Sep 06, 2026 – Present</span>
                </div>

                <div className="flex justify-between items-center pt-3">
                  <span className="text-muted-foreground font-medium">Rule</span>
                  <span className="text-foreground font-medium">
                    Duplicate invoice detected (R-005)
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3">
                  <span className="text-muted-foreground font-medium">Last Checked</span>
                  <span className="font-mono text-muted-foreground">Oct 01, 2026</span>
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
        {/* REOPEN CONFIRMATION MODAL */}
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
