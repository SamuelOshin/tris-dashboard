'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, RiskCase, CaseTransitionPayload, enrichSignal, formatCurrency } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import {
  ShieldAlert,
  ArrowLeft,
  Clock,
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
  ChevronRight,
  Stamp,
  Search,
  ArrowUpDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const caseId = params?.id as string

  const [caseData, setCaseData] = useState<RiskCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Audit Trail Controls State (Bounded Scrolling & Search)
  const [auditSearchQuery, setAuditSearchQuery] = useState('')
  const [auditSortOrder, setAuditSortOrder] = useState<'desc' | 'asc'>('desc')
  const [auditVisibleCount, setAuditVisibleCount] = useState(25)

  // Verified Closure Modal State
  const [closureModalOpen, setClosureModalOpen] = useState(false)
  const [closureForm, setClosureForm] = useState({
    root_cause: '',
    corrective_action: '',
    closure_type: 'Confirmed Fraud / Blocked',
    closure_evidence: '',
    verified_by: user?.name ? `${user.name} (${user.role})` : 'Independent Controls Auditor',
    closure_date: new Date().toISOString().split('T')[0],
    follow_up_requirement: '',
    recurrence_monitoring: 'Enrolled in 90-day automated bank modification monitoring',
  })
  const [closureErrors, setClosureErrors] = useState<string[]>([])

  // Reopen Case Modal State
  const [reopenModalOpen, setReopenModalOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState('Inconsistent vendor callback documentation received; reopening for active inquiry')

  const openClosureModal = () => {
    if (caseData) {
      setClosureForm({
        root_cause: caseData.root_cause || '',
        corrective_action: caseData.corrective_action || '',
        closure_type: caseData.closure_type || 'Confirmed Fraud / Blocked',
        closure_evidence: caseData.closure_evidence || '',
        verified_by: user?.name ? `${user.name} (${user.role})` : (caseData.verified_by || 'Independent Controls Auditor'),
        closure_date: new Date().toISOString().split('T')[0],
        follow_up_requirement: caseData.follow_up_requirement || '',
        recurrence_monitoring: caseData.recurrence_monitoring || 'Enrolled in 90-day automated bank modification monitoring',
      })
    }
    setClosureErrors([])
    setClosureModalOpen(true)
  }

  const loadCase = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getCase(caseId)
      setCaseData(data)
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
    try {
      const payload: CaseTransitionPayload = {
        to_status: toStatus,
        actor: user?.name || 'Authorized Auditor',
        note: `Status transition to ${toStatus}`,
        ...extra,
      }
      const updated = await api.transitionCase(caseId, payload)
      setCaseData(updated)
      setClosureModalOpen(false)
    } catch (err: any) {
      setError(err.message || `Failed to transition case to ${toStatus}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleVerifiedClosureSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setClosureErrors([])

    const missing: string[] = []
    if (!closureForm.root_cause.trim()) missing.push('Root Cause Analysis')
    if (!closureForm.corrective_action.trim()) missing.push('Corrective Action Plan')
    if (!closureForm.closure_type.trim()) missing.push('Closure Type')
    if (!closureForm.closure_evidence.trim()) missing.push('Closure Evidence & Artifacts')
    if (!closureForm.verified_by.trim()) missing.push('Verified By (Independent Verifier)')
    if (!closureForm.closure_date) missing.push('Closure Date')
    if (!closureForm.follow_up_requirement.trim()) missing.push('Follow-Up Requirement')
    if (!closureForm.recurrence_monitoring.trim()) missing.push('Recurrence Monitoring Protocol')

    if (missing.length > 0) {
      setClosureErrors(missing)
      return
    }

    await handleTransition('Closed', closureForm)
  }

  if (loading) {
    return (
      <DashboardLayout
        title="Loading Case..."
        breadcrumbs={[
          { label: 'TRIS Studio', href: '/' },
          { label: 'Cases & Fraud', href: '/fraud-detection' },
          { label: caseId },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground font-mono">Loading governed case workspace...</p>
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
          { label: 'TRIS Studio', href: '/' },
          { label: 'Cases & Fraud', href: '/fraud-detection' },
          { label: caseId },
        ]}
      >
        <Card className="p-8 text-center space-y-4 bg-card border-border max-w-lg mx-auto my-12">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Case Not Found</h2>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" onClick={() => router.push('/fraud-detection')} className="text-xs">
            Return to Case Ledger
          </Button>
        </Card>
      </DashboardLayout>
    )
  }

  if (!caseData) return null

  // Enrich signals for robust rendering
  const enrichedSignals = (caseData.trigger_signals || []).map((s) => enrichSignal(s))

  return (
    <DashboardLayout
      title={`Case: ${caseData.case_id}`}
      description={`Governed Case State Machine · Target ${caseData.transaction_id} · Supplier ${caseData.supplier_id}`}
      breadcrumbs={[
        { label: 'TRIS Studio', href: '/' },
        { label: 'Cases & Fraud', href: '/fraud-detection' },
        { label: caseData.case_id },
      ]}
    >
      <div className="space-y-6">
        {/* Case Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/fraud-detection"
              className="p-2 rounded-lg bg-muted/30 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold font-mono text-foreground tracking-tight">{caseData.case_id}</h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase border ${
                    caseData.priority?.toLowerCase() === 'high'
                      ? 'bg-destructive/15 text-destructive border-destructive/30'
                      : 'bg-warning/15 text-warning border-warning/30'
                  }`}
                >
                  {caseData.priority} Priority
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 uppercase">
                  {caseData.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                Target Invoice: <span className="font-semibold text-foreground">{caseData.transaction_id}</span> · Supplier:{' '}
                <span className="font-semibold text-foreground">{caseData.supplier_id}</span>
              </p>
            </div>
          </div>

          {/* Governed State Machine Action Controls */}
          <div className="flex items-center gap-2.5">
            {caseData.status === 'New' && (
              <Button
                size="sm"
                onClick={() => handleTransition('Assigned', { assigned_to: user?.name || 'Lead Investigator' })}
                disabled={actionLoading}
                className="text-xs"
              >
                Assign Case
              </Button>
            )}
            {caseData.status === 'Assigned' && (
              <Button
                size="sm"
                onClick={() => handleTransition('Under Investigation')}
                disabled={actionLoading}
                className="text-xs"
              >
                Begin Investigation
              </Button>
            )}
            {caseData.status === 'Under Investigation' && (
              <Button
                size="sm"
                onClick={() => handleTransition('Corrective Action')}
                disabled={actionLoading}
                className="text-xs"
              >
                Initiate Corrective Action
              </Button>
            )}
            {caseData.status === 'Corrective Action' && (
              <Button
                size="sm"
                onClick={() => handleTransition('Pending Verification')}
                disabled={actionLoading}
                className="text-xs"
              >
                Submit for Verification
              </Button>
            )}
            {caseData.status === 'Pending Verification' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTransition('Under Investigation', { note: 'Verification rejected: requires further inquiry' })}
                  disabled={actionLoading}
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Reject Verification
                </Button>
                <Button
                  size="sm"
                  onClick={openClosureModal}
                  disabled={actionLoading}
                  className="text-xs bg-success text-success-foreground hover:bg-success/90 gap-1.5 shadow-xs font-semibold"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Verified Closure (8 Fields)
                </Button>
              </>
            )}
            {caseData.status === 'Closed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReopenModalOpen(true)}
                disabled={actionLoading}
                className="text-xs gap-1.5 font-mono"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reopen Case
              </Button>
            )}
            {caseData.status === 'Reopened' && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleTransition('Under Investigation', { note: 'Investigation resumed on reopened case' })}
                  disabled={actionLoading}
                  className="text-xs"
                >
                  Resume Investigation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTransition('Pending Verification', { note: 'Direct re-verification requested' })}
                  disabled={actionLoading}
                  className="text-xs"
                >
                  Submit for Re-Verification
                </Button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Closed Seal Card if status is Closed */}
        {caseData.status === 'Closed' && (
          <Card className="p-6 border border-success/30 bg-success/[0.03] space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-success" />
            <div className="flex items-start gap-4">
              <div className="p-3 bg-success/15 border border-success/20 rounded-xl text-success shrink-0">
                <Stamp className="w-6 h-6" />
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">Verified Closure Compliance Certificate</h3>
                    <span className="text-[10px] font-mono font-bold bg-success/20 text-success px-2 py-0.5 rounded-full uppercase border border-success/30">
                      COMPLIANT · SOX AUDITED
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sealed on <strong className="text-foreground font-mono">{caseData.closure_date}</strong> by independent verifier{' '}
                    <strong className="text-foreground">{caseData.verified_by}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-success/20">
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">1. Root Cause</span>
                    <p className="text-foreground font-medium">{caseData.root_cause}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">2. Closure Type</span>
                    <p className="text-foreground font-medium">{caseData.closure_type}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">3. Corrective Action</span>
                    <p className="text-foreground font-medium">{caseData.corrective_action}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">4. Evidence Artifact</span>
                    <p className="text-foreground font-mono">{caseData.closure_evidence}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">5. Follow-Up Requirement</span>
                    <p className="text-foreground font-medium">{caseData.follow_up_requirement}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">6. Recurrence Surveillance</span>
                    <p className="text-foreground font-medium">{caseData.recurrence_monitoring}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Reopened Banner */}
        {caseData.status === 'Reopened' && (
          <Card className="p-4 border border-warning/30 bg-warning/5 space-y-2">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-warning shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-foreground">Case Reopened for Active Inquiry</h4>
                <p className="text-xs text-muted-foreground">
                  Supervisor requested additional forensic reconciliation. Resumed under governed investigation state.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Two-Column Grid: Triggered Signals & Chronological Audit Trail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Multi-Signal Detections (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight">
                    Consolidated Detection Signals ({enrichedSignals.length})
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Risk signals and triggered detection rules</p>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground">
                  Additive Scoring
                </span>
              </div>

              {/* Bounded signals list with internal scroll */}
              <div className="max-h-[340px] overflow-y-auto pr-1 space-y-3">
                {enrichedSignals.map((signal) => (
                  <div
                    key={signal.rule_code}
                    className="p-4 rounded-xl bg-muted/15 space-y-2 transition-colors hover:bg-muted/25"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-md shrink-0">
                          {signal.rule_code}
                        </span>
                        <h4 className="font-semibold text-foreground text-xs sm:text-sm truncate">{signal.rule_name}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          v{signal.rule_version}.0
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 bg-destructive/10 text-destructive rounded-md shrink-0">
                        +{signal.score} pts
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{signal.explanation}</p>

                    {signal.diagnostics && Object.keys(signal.diagnostics).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30 text-[11px] font-mono text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {Object.entries(signal.diagnostics).map(([k, v]) => (
                          <div key={k} className="p-1.5 rounded-lg bg-muted/20">
                            <span className="text-muted-foreground/70">{k}: </span>
                            <span className="text-foreground font-semibold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Recurrence Surveillance & Prior Case History Widget */}
            <Card className="p-6 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Recurrence Surveillance & Prior Case History</h3>
                    <p className="text-xs text-muted-foreground">90-day lookback across supplier {caseData.supplier_id} (Rule R-006)</p>
                  </div>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground">
                  {caseData.prior_cases?.length || 0} Prior Cases
                </span>
              </div>

              {(!caseData.prior_cases || caseData.prior_cases.length === 0) ? (
                <div className="p-4 rounded-xl bg-success/5 border border-success/20 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-foreground">Zero Recurrence Detected</p>
                    <p className="text-muted-foreground leading-relaxed">
                      No prior control failure cases recorded for vendor <span className="font-mono font-semibold text-foreground">{caseData.supplier_id}</span> within the configured 90-day surveillance window. This represents an isolated anomaly under R-006 monitoring.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2.5">
                  {caseData.prior_cases.map((pc: any) => (
                    <div key={pc.case_id} className="p-3.5 rounded-xl border border-warning/30 bg-warning/5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-foreground">{pc.case_id}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {pc.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">Prior Root Cause: {pc.root_cause || 'Under investigation'}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Bounded Immutable Chronological Audit Trail (1/3 width) */}
          <div className="space-y-6">
            {(() => {
              const filteredHistory = (caseData.history || [])
                .filter((item) => {
                  if (!auditSearchQuery.trim()) return true
                  const q = auditSearchQuery.toLowerCase()
                  return (
                    item.action.toLowerCase().includes(q) ||
                    item.actor.toLowerCase().includes(q) ||
                    (item.note && item.note.toLowerCase().includes(q))
                  )
                })
                .sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime()
                  const timeB = new Date(b.timestamp).getTime()
                  return auditSortOrder === 'desc' ? timeB - timeA : timeA - timeB
                })

              return (
                <Card className="p-5.5 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] h-[620px] flex flex-col overflow-hidden">
                  {/* Pinned Sticky Header */}
                  <div className="pb-3 border-b border-border/30 space-y-2.5 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">Audit Trail</h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border-0 font-semibold">
                        {filteredHistory.length} Events
                      </span>
                    </div>

                    {/* Search & Chronological Sort Controls */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search events, actors..."
                          value={auditSearchQuery}
                          onChange={(e) => setAuditSearchQuery(e.target.value)}
                          className="pl-8 h-7 text-xs bg-muted/20 border-border"
                        />
                      </div>
                      <button
                        onClick={() => setAuditSortOrder(auditSortOrder === 'desc' ? 'asc' : 'desc')}
                        className="h-7 px-2 text-[10px] font-mono font-medium rounded-lg border border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 transition-colors"
                        title="Toggle sort order"
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        {auditSortOrder === 'desc' ? 'Newest' : 'Oldest'}
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Timeline Area */}
                  <div className="flex-1 overflow-y-auto pr-2 mt-3 space-y-4">
                    {filteredHistory.length === 0 ? (
                      <div className="text-center py-16 text-xs text-muted-foreground space-y-1">
                        <p>No audit events match your filter.</p>
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                        {filteredHistory.slice(0, auditVisibleCount).map((item, idx) => (
                          <div key={item.history_id || idx} className="relative space-y-1 text-xs">
                            <div className="absolute -left-6 top-1 w-2 h-2 rounded-full bg-primary ring-4 ring-card" />
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-semibold text-foreground truncate">{item.action}</p>
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              Actor: <span className="text-foreground font-medium">{item.actor}</span>
                            </p>
                            {item.note && (
                              <p className="text-[11px] bg-muted/30 p-2 rounded border border-border/50 text-muted-foreground italic leading-relaxed">
                                &quot;{item.note}&quot;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Load More Footer if > visible count */}
                  {filteredHistory.length > auditVisibleCount && (
                    <div className="pt-2 border-t border-border shrink-0 text-center">
                      <button
                        onClick={() => setAuditVisibleCount((prev) => prev + 25)}
                        className="text-[11px] font-mono text-primary hover:underline"
                      >
                        Showing {auditVisibleCount} of {filteredHistory.length} · Load 25 more
                      </button>
                    </div>
                  )}
                </Card>
              )
            })()}
          </div>
        </div>

        {/* 8-Field Verified Closure Modal */}
        {closureModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
            <Card className="w-full max-w-2xl p-6 space-y-5 my-8 bg-card border-border shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/15 text-success rounded-xl border border-success/20">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">Verified Closure Compliance Gate</h3>
                    <p className="text-xs text-muted-foreground">All 8 fields are mandatory under internal SOX control governance.</p>
                  </div>
                </div>
                <button
                  onClick={() => setClosureModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {closureErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive text-xs space-y-1.5 border border-destructive/20">
                  <p className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Incomplete Attestation ({closureErrors.length} required fields missing):
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {closureErrors.map((err) => (
                      <span key={err} className="px-2 py-0.5 rounded bg-destructive/15 font-mono text-[10px]">
                        {err}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifiedClosureSubmit} className="space-y-4 text-xs">
                {/* Phase 1: Forensic Root-Cause & Action */}
                <div className="space-y-3 p-3.5 rounded-xl bg-muted/10 border border-border/60">
                  <p className="text-[11px] font-mono font-semibold uppercase text-muted-foreground tracking-wider">
                    Phase 1: Forensic Findings & Remedy
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="closure_root_cause" className="font-semibold text-foreground">
                        1. Root Cause Analysis *
                      </label>
                      <input
                        id="closure_root_cause"
                        type="text"
                        value={closureForm.root_cause}
                        onChange={(e) => setClosureForm({ ...closureForm, root_cause: e.target.value })}
                        placeholder="e.g. Compromised vendor portal credentials"
                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="closure_type" className="font-semibold text-foreground">
                        2. Closure Classification *
                      </label>
                      <select
                        id="closure_type"
                        value={closureForm.closure_type}
                        onChange={(e) => setClosureForm({ ...closureForm, closure_type: e.target.value })}
                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Confirmed Fraud / Blocked">Confirmed Fraud / Blocked</option>
                        <option value="Process Error / Remedied">Process Error / Remedied</option>
                        <option value="Legitimate Exception Approved">Legitimate Exception Approved</option>
                        <option value="False Positive / Threshold Adjusted">False Positive / Threshold Adjusted</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="closure_corrective_action" className="font-semibold text-foreground">
                      3. Corrective Action Taken *
                    </label>
                    <textarea
                      id="closure_corrective_action"
                      rows={2}
                      value={closureForm.corrective_action}
                      onChange={(e) => setClosureForm({ ...closureForm, corrective_action: e.target.value })}
                      placeholder="e.g. Bank details reverted; payment hold placed on invoice NC-260828"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="closure_evidence" className="font-semibold text-foreground">
                      4. Closure Evidence Artifact / Ticket Ref *
                    </label>
                    <input
                      id="closure_evidence"
                      type="text"
                      value={closureForm.closure_evidence}
                      onChange={(e) => setClosureForm({ ...closureForm, closure_evidence: e.target.value })}
                      placeholder="e.g. Audit ticket SEC-2026-881; direct callback confirmation with supplier CFO"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>

                {/* Phase 2: Independent Governance Attestation */}
                <div className="space-y-3 p-3.5 rounded-xl bg-muted/10 border border-border/60">
                  <p className="text-[11px] font-mono font-semibold uppercase text-muted-foreground tracking-wider">
                    Phase 2: Governance Attestation & Surveillance
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="closure_verified_by" className="font-semibold text-foreground">
                        5. Verified By (Independent Auditor) *
                      </label>
                      <input
                        id="closure_verified_by"
                        type="text"
                        value={closureForm.verified_by}
                        onChange={(e) => setClosureForm({ ...closureForm, verified_by: e.target.value })}
                        placeholder="e.g. B. Verifier (Compliance Lead)"
                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="closure_date" className="font-semibold text-foreground">
                        6. Closure Date *
                      </label>
                      <input
                        id="closure_date"
                        type="date"
                        value={closureForm.closure_date}
                        onChange={(e) => setClosureForm({ ...closureForm, closure_date: e.target.value })}
                        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="closure_follow_up" className="font-semibold text-foreground">
                      7. Follow-Up Requirement *
                    </label>
                    <input
                      id="closure_follow_up"
                      type="text"
                      value={closureForm.follow_up_requirement}
                      onChange={(e) => setClosureForm({ ...closureForm, follow_up_requirement: e.target.value })}
                      placeholder="e.g. Mandatory MFA rollout for vendor portal administrator accounts within 14 days"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="closure_recurrence_monitoring" className="font-semibold text-foreground">
                      8. Recurrence Monitoring Protocol *
                    </label>
                    <input
                      id="closure_recurrence_monitoring"
                      type="text"
                      value={closureForm.recurrence_monitoring}
                      onChange={(e) => setClosureForm({ ...closureForm, recurrence_monitoring: e.target.value })}
                      placeholder="e.g. Enrolled in 90-day automated bank modification monitoring on supplier SUP-001"
                      className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setClosureModalOpen(false)}
                    disabled={actionLoading}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={actionLoading}
                    className="text-xs bg-success text-success-foreground hover:bg-success/90 font-semibold gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {actionLoading ? 'Attesting & Sealing...' : 'Attest & Seal Case (8 Fields)'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Reopen Case Confirmation Modal */}
        {reopenModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
            <Card className="w-full max-w-md p-6 space-y-4 my-8 bg-card border-border shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-warning/15 text-warning rounded-lg border border-warning/30">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Reopen Case for Inquiry</h3>
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
                <label htmlFor="reopen_reason" className="font-semibold text-foreground">
                  Reopening Rationale / Auditor Note *
                </label>
                <textarea
                  id="reopen_reason"
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Inconsistent supplier callback documentation received; requires forensic bank re-verification"
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
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
                  className="text-xs bg-warning text-warning-foreground hover:bg-warning/90 font-semibold"
                  disabled={actionLoading || !reopenReason.trim()}
                  onClick={async () => {
                    await handleTransition('Reopened', { note: reopenReason })
                    setReopenModalOpen(false)
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
