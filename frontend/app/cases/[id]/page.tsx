'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api, RiskCase, CaseTransitionPayload } from '@/lib/api'
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
  XCircle,
  RotateCcw,
} from 'lucide-react'
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

    // Validate 8 fields client-side before sending
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
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading governed case workspace...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error && !caseData) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Case Not Found</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.push('/fraud-detection')}>Return to Fraud Workspace</Button>
        </div>
      </DashboardLayout>
    )
  }

  if (!caseData) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/fraud-detection" className="p-2 rounded-lg bg-card border border-border hover:bg-muted text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{caseData.case_id}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                  caseData.priority === 'High' ? 'bg-destructive/10 text-destructive' :
                  caseData.priority === 'Medium' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                }`}>
                  {caseData.priority} Priority
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase">
                  {caseData.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Target Transaction: <span className="font-mono text-foreground font-medium">{caseData.transaction_id}</span> · Supplier: <span className="font-mono text-foreground font-medium">{caseData.supplier_id}</span>
              </p>
            </div>
          </div>

          {/* Governed State Machine Action Controls */}
          <div className="flex items-center gap-3">
            {caseData.status === 'New' && (
              <Button
                onClick={() => handleTransition('Assigned', { assigned_to: user?.name || 'Lead Investigator' })}
                disabled={actionLoading}
              >
                Assign Case
              </Button>
            )}
            {caseData.status === 'Assigned' && (
              <Button
                onClick={() => handleTransition('Under Investigation')}
                disabled={actionLoading}
              >
                Begin Investigation
              </Button>
            )}
            {caseData.status === 'Under Investigation' && (
              <Button
                onClick={() => handleTransition('Corrective Action')}
                disabled={actionLoading}
              >
                Initiate Corrective Action
              </Button>
            )}
            {caseData.status === 'Corrective Action' && (
              <Button
                onClick={() => handleTransition('Pending Verification')}
                disabled={actionLoading}
              >
                Submit for Verification
              </Button>
            )}
            {caseData.status === 'Pending Verification' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleTransition('Under Investigation', { note: 'Verification rejected: requires further inquiry' })}
                  disabled={actionLoading}
                  className="text-destructive border-destructive/20 hover:bg-destructive/10"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Verification
                </Button>
                <Button
                  onClick={() => setClosureModalOpen(true)}
                  disabled={actionLoading}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Verified Closure (8 Fields)
                </Button>
              </>
            )}
            {caseData.status === 'Closed' && (
              <Button
                variant="outline"
                onClick={() => handleTransition('Reopened', { note: 'Case reopened by supervisor' })}
                disabled={actionLoading}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reopen Case
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Closed Seal Card if status is Closed */}
        {caseData.status === 'Closed' && (
          <Card className="p-6 border-success/30 bg-success/5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-success/20 rounded-xl text-success">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    Verified Closure Seal
                    <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full uppercase">Compliant</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Closed on {caseData.closure_date} by {caseData.verified_by}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Root Cause</span>
                    <p className="text-foreground mt-0.5">{caseData.root_cause}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Corrective Action</span>
                    <p className="text-foreground mt-0.5">{caseData.corrective_action}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Closure Type</span>
                    <p className="text-foreground mt-0.5">{caseData.closure_type}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Evidence Artifact</span>
                    <p className="text-foreground mt-0.5">{caseData.closure_evidence}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Follow-up Requirement</span>
                    <p className="text-foreground mt-0.5">{caseData.follow_up_requirement}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Recurrence Surveillance</span>
                    <p className="text-foreground mt-0.5">{caseData.recurrence_monitoring}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Two-Column Grid: Triggered Signals & Chronological Audit Trail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Multi-Signal Detections (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center justify-between">
                <span>Consolidated Detection Signals ({caseData.trigger_signals?.length || 0})</span>
                <span className="text-xs text-muted-foreground font-normal">Deterministic Heuristics Engine</span>
              </h2>

              <div className="space-y-4">
                {caseData.trigger_signals?.map((signal) => (
                  <div
                    key={signal.rule_code}
                    className="p-4 rounded-lg border border-border bg-card/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded">
                          {signal.rule_code}
                        </span>
                        <h4 className="font-semibold text-foreground text-sm">{signal.rule_name}</h4>
                        <span className="text-xs text-muted-foreground">v{signal.rule_version}</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-destructive/10 text-destructive rounded">
                        +{signal.score} pts (Weight {signal.weight})
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">{signal.explanation}</p>

                    {signal.diagnostics && Object.keys(signal.diagnostics).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50 text-xs font-mono text-muted-foreground grid grid-cols-2 gap-2">
                        {Object.entries(signal.diagnostics).map(([k, v]) => (
                          <div key={k}>
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
          </div>

          {/* Right Column: Immutable Chronological Audit Trail (1/3 width) */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <span>Audit Trail</span>
              </h2>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {caseData.history?.map((item, idx) => (
                  <div key={item.history_id || idx} className="relative space-y-1">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">{item.action}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Actor: <span className="text-foreground font-medium">{item.actor}</span>
                    </p>
                    {item.note && (
                      <p className="text-xs bg-muted/40 p-2 rounded text-muted-foreground italic">
                        &quot;{item.note}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* 8-Field Verified Closure Modal */}
        {closureModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
            <Card className="w-full max-w-2xl p-6 space-y-6 my-8 bg-card border-border shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 text-success rounded-lg">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Verified Closure Compliance Gate</h3>
                    <p className="text-xs text-muted-foreground">All 8 fields are mandatory under internal control governance.</p>
                  </div>
                </div>
                <button
                  onClick={() => setClosureModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {closureErrors.length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm space-y-1">
                  <p className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Missing Mandatory Closure Fields:
                  </p>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    {closureErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={handleVerifiedClosureSubmit} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">1. Root Cause Analysis *</label>
                    <input
                      type="text"
                      value={closureForm.root_cause}
                      onChange={(e) => setClosureForm({ ...closureForm, root_cause: e.target.value })}
                      placeholder="e.g. Compromised vendor portal account"
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">2. Closure Type *</label>
                    <select
                      value={closureForm.closure_type}
                      onChange={(e) => setClosureForm({ ...closureForm, closure_type: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Confirmed Fraud / Blocked">Confirmed Fraud / Blocked</option>
                      <option value="Process Error / Remedied">Process Error / Remedied</option>
                      <option value="Legitimate Exception Approved">Legitimate Exception Approved</option>
                      <option value="False Positive / Threshold Adjusted">False Positive / Threshold Adjusted</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">3. Corrective Action Taken *</label>
                  <textarea
                    rows={2}
                    value={closureForm.corrective_action}
                    onChange={(e) => setClosureForm({ ...closureForm, corrective_action: e.target.value })}
                    placeholder="e.g. Bank details reverted; payment hold placed on invoice NC-260828"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">4. Closure Evidence / Ticket Reference *</label>
                  <input
                    type="text"
                    value={closureForm.closure_evidence}
                    onChange={(e) => setClosureForm({ ...closureForm, closure_evidence: e.target.value })}
                    placeholder="e.g. Audit ticket SEC-2026-881; phone confirmation with CFO"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">5. Verified By (Independent) *</label>
                    <input
                      type="text"
                      value={closureForm.verified_by}
                      onChange={(e) => setClosureForm({ ...closureForm, verified_by: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">6. Closure Date *</label>
                    <input
                      type="date"
                      value={closureForm.closure_date}
                      onChange={(e) => setClosureForm({ ...closureForm, closure_date: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">7. Follow-Up Requirement *</label>
                  <input
                    type="text"
                    value={closureForm.follow_up_requirement}
                    onChange={(e) => setClosureForm({ ...closureForm, follow_up_requirement: e.target.value })}
                    placeholder="e.g. Mandatory MFA rollout for vendor admins"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">8. Recurrence Monitoring Protocol *</label>
                  <input
                    type="text"
                    value={closureForm.recurrence_monitoring}
                    onChange={(e) => setClosureForm({ ...closureForm, recurrence_monitoring: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClosureModalOpen(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionLoading}
                    className="bg-success text-success-foreground hover:bg-success/90"
                  >
                    {actionLoading ? 'Verifying & Sealing...' : 'Confirm Verified Closure'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
