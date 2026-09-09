'use client'

import React from 'react'
import {
  Lock,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskCase } from '@/lib/api'
import { isClosureLocked } from '../case-workflow-guards'

const CLOSURE_TYPES = [
  'Confirmed Fraud / Blocked',
  'Process Error / Remedied',
  'Legitimate Exception Approved',
  'False Positive / Threshold Adjusted',
] as const

interface ClosureFormValues {
  closureType: string
  closureEvidence: string
  followUpRequirement: string
  recurrenceMonitoring: string
  verifiedBy: string
  closureDate: string
}

interface ClosureTabProps {
  caseData: RiskCase
  closureNotes: string
  onChangeClosureNotes: (notes: string) => void
  closureForm: ClosureFormValues
  onChangeClosureField: (field: keyof ClosureFormValues, value: string) => void
  hasRootCause: boolean
  hasCorrectiveAction: boolean
  hasEvidence: boolean
  closureValidationErrors: string[]
  onGoToInvestigation: () => void
  onGoToCorrectiveAction: () => void
  onAdvanceToVerification: () => Promise<any>
  onExecuteClosure: () => Promise<any>
  isActionLoading: boolean
}

export function ClosureTab({
  caseData,
  closureNotes,
  onChangeClosureNotes,
  closureForm,
  onChangeClosureField,
  hasRootCause,
  hasCorrectiveAction,
  hasEvidence,
  closureValidationErrors,
  onGoToInvestigation,
  onGoToCorrectiveAction,
  onAdvanceToVerification,
  onExecuteClosure,
  isActionLoading,
}: ClosureTabProps) {
  const isClosed = caseData.status === 'Closed'
  const isLocked = isClosureLocked(caseData)
  const isPendingOrClosed =
    caseData.status === 'Pending Verification' || isClosed

  const hasClosureType = Boolean(closureForm.closureType)
  const hasFollowUp = Boolean(closureForm.followUpRequirement.trim())
  const hasRecurrence = Boolean(closureForm.recurrenceMonitoring.trim())
  const hasVerifiedBy = Boolean(closureForm.verifiedBy.trim())
  const hasClosureDate = Boolean(closureForm.closureDate)

  // All 8 criteria
  const satisfiedCount = [
    hasRootCause,
    hasCorrectiveAction,
    hasEvidence,
    isPendingOrClosed,
    hasClosureType,
    hasFollowUp,
    hasRecurrence,
    hasVerifiedBy && hasClosureDate,
  ].filter(Boolean).length

  const allSatisfied = satisfiedCount === 8
  const isEditable = isPendingOrClosed && !isClosed

  return (
    <div className="space-y-6 pt-2">
      <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-5 max-w-3xl">
        <div>
          <h2 className="text-sm font-bold text-foreground">Closure Information</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            TRIS enforces system-validated closure. All 8 mandatory criteria must be satisfied.
          </p>
        </div>

        {/* Stage-based Lock State */}
        {isLocked && (
          <div className="p-4 rounded-xl bg-slate-500/10 border border-border text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-bold text-foreground">
                  Closure Locked — Workflow Progression Required
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {caseData.status === 'New' || caseData.status === 'Assigned'
                    ? 'This case must be investigated and remediated before closure verification can be requested.'
                    : caseData.status === 'Under Investigation'
                      ? 'Investigation in progress. Document root cause and advance to Corrective Action first.'
                      : 'Remediation plan active. Advance the case to Pending Verification to unlock final sign-off.'}
                </p>
              </div>
            </div>
            {caseData.status === 'New' || caseData.status === 'Assigned' ? (
              <Button
                size="sm"
                onClick={onGoToInvestigation}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-medium"
              >
                Go to Investigation Tab →
              </Button>
            ) : caseData.status === 'Under Investigation' ? (
              <Button
                size="sm"
                onClick={onGoToCorrectiveAction}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-medium"
              >
                Go to Corrective Action →
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onAdvanceToVerification}
                disabled={isActionLoading || !hasCorrectiveAction}
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
              <strong>Verification Gate Active:</strong> Complete the closure fields below, then submit for final system-validated sign-off.
            </span>
          </div>
        )}

        {/* Closure Validation Errors */}
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

        {/* Checklist */}
        <div className="space-y-2.5 p-4 rounded-xl bg-muted/20 border border-border/60 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-bold text-foreground text-xs block">Closure Validation Checklist</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {satisfiedCount} of 8 Satisfied
            </span>
          </div>

          {[
            {
              checked: hasRootCause,
              label: 'Root cause documented',
              action: !hasRootCause ? (
                <button onClick={onGoToInvestigation} className="text-primary hover:underline">
                  Required in Investigation →
                </button>
              ) : <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Documented</span>,
            },
            {
              checked: hasCorrectiveAction,
              label: 'Corrective action completed',
              action: !hasCorrectiveAction ? (
                <button onClick={onGoToCorrectiveAction} className="text-primary hover:underline">
                  Required in Corrective Action →
                </button>
              ) : <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Action Recorded</span>,
            },
            {
              checked: hasEvidence,
              label: 'Closure evidence provided',
              action: hasEvidence
                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Attached</span>
                : <span className="text-muted-foreground">Enter below</span>,
            },
            {
              checked: isPendingOrClosed,
              label: 'Verification gate active (Pending Verification)',
              action: isPendingOrClosed
                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Active</span>
                : <span className="text-amber-600 dark:text-amber-400">Current: {caseData.status}</span>,
            },
            {
              checked: hasClosureType,
              label: 'Closure type selected',
              action: hasClosureType
                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[160px] inline-block">✓ {closureForm.closureType}</span>
                : <span className="text-muted-foreground">Select below</span>,
            },
            {
              checked: hasFollowUp,
              label: 'Follow-up requirement specified',
              action: hasFollowUp
                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Specified</span>
                : <span className="text-muted-foreground">Enter below</span>,
            },
            {
              checked: hasRecurrence,
              label: 'Recurrence monitoring plan documented',
              action: hasRecurrence
                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Documented</span>
                : <span className="text-muted-foreground">Enter below</span>,
            },
            {
              checked: hasVerifiedBy && hasClosureDate,
              label: 'Verified by and closure date set',
              action: hasVerifiedBy && hasClosureDate
                ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Set</span>
                : <span className="text-muted-foreground">Enter below</span>,
            },
          ].map(({ checked, label, action }) => (
            <div key={label} className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className={checked ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  {label}
                </span>
              </label>
              <span className="text-[10px] font-mono">{action}</span>
            </div>
          ))}
        </div>

        {/* Closure Form Fields — only active when Pending Verification */}
        <div className="space-y-4 text-xs">
          {/* Row 1: Closure Type */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">
              Closure Type <span className="text-destructive">*</span>
            </label>
            <select
              value={closureForm.closureType}
              disabled={!isEditable}
              onChange={(e) => onChangeClosureField('closureType', e.target.value)}
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:bg-muted/20"
            >
              <option value="">Select closure classification...</option>
              {CLOSURE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Closure Evidence */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">
              Closure Evidence <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={closureForm.closureEvidence}
              disabled={!isEditable}
              onChange={(e) => onChangeClosureField('closureEvidence', e.target.value)}
              placeholder="e.g. invoice_audit_log.pdf, cfo_signoff.pdf"
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:bg-muted/20"
            />
          </div>

          {/* Row 3: Follow-up Requirement */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">
              Follow-up Requirement <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={2}
              value={closureForm.followUpRequirement}
              disabled={!isEditable}
              onChange={(e) => onChangeClosureField('followUpRequirement', e.target.value)}
              placeholder="Describe any follow-up actions or monitoring requirements..."
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
            />
          </div>

          {/* Row 4: Recurrence Monitoring */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">
              Recurrence Monitoring Plan <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={2}
              value={closureForm.recurrenceMonitoring}
              disabled={!isEditable}
              onChange={(e) => onChangeClosureField('recurrenceMonitoring', e.target.value)}
              placeholder="Describe the monitoring plan to prevent recurrence (e.g. 90-day automated review)..."
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
            />
          </div>

          {/* Row 5: Verified By + Closure Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Verified By <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={closureForm.verifiedBy}
                disabled={!isEditable}
                onChange={(e) => onChangeClosureField('verifiedBy', e.target.value)}
                placeholder="Full name of verifying reviewer"
                className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:bg-muted/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Closure Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={closureForm.closureDate}
                disabled={!isEditable}
                onChange={(e) => onChangeClosureField('closureDate', e.target.value)}
                className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 disabled:bg-muted/20"
              />
            </div>
          </div>

          {/* Row 6: Closure Notes */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Closure Notes</label>
            <textarea
              rows={2}
              value={closureNotes}
              disabled={!isEditable}
              onChange={(e) => onChangeClosureNotes(e.target.value)}
              placeholder="Enter closure confirmation notes and any additional context..."
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
            />
          </div>

          {/* Submit Row */}
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
            <div>
              <span className="font-semibold text-foreground text-xs block">Close Case</span>
              <p className="text-[11px] text-muted-foreground">
                {isClosed
                  ? 'Case has completed system-validated closure.'
                  : caseData.status === 'Pending Verification'
                    ? 'Complete all 8 criteria above, then submit for final sign-off.'
                    : caseData.status === 'Corrective Action'
                      ? 'Advance case to Pending Verification once remediation is completed.'
                      : 'Case must progress through investigation and corrective action before closing.'}
              </p>
            </div>

            <div>
              {isClosed ? (
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Case Closed & Verified
                </span>
              ) : caseData.status === 'Pending Verification' ? (
                <Button
                  size="sm"
                  onClick={onExecuteClosure}
                  disabled={isActionLoading || !allSatisfied}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4"
                >
                  {isActionLoading ? 'Validating Closure...' : 'Mark as Closed'}
                </Button>
              ) : caseData.status === 'Corrective Action' ? (
                <Button
                  size="sm"
                  onClick={onAdvanceToVerification}
                  disabled={isActionLoading || !hasCorrectiveAction}
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4"
                >
                  {isActionLoading ? 'Transitioning...' : 'Advance to Pending Verification →'}
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
  )
}
