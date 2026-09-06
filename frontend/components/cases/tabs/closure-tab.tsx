'use client'

import React from 'react'
import {
  Lock,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskCase } from '@/lib/api'
import { isClosureLocked } from '../case-workflow-guards'

interface ClosureTabProps {
  caseData: RiskCase
  closureNotes: string
  onChangeClosureNotes: (notes: string) => void
  hasRootCause: boolean
  hasCorrectiveAction: boolean
  hasEvidence: boolean
  supportingEvidence?: string
  evidenceOfAction?: string
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
  hasRootCause,
  hasCorrectiveAction,
  hasEvidence,
  supportingEvidence,
  evidenceOfAction,
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

  const satisfiedCount = [
    hasRootCause,
    hasCorrectiveAction,
    hasEvidence,
    isPendingOrClosed,
  ].filter(Boolean).length

  return (
    <div className="space-y-6 pt-2">
      <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-5 max-w-3xl">
        <div>
          <h2 className="text-sm font-bold text-foreground">Closure Information</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            TRIS enforces system-validated closure. All mandatory criteria must be satisfied.
          </p>
        </div>

        {/* Stage-based Lock State for Closure Tab */}
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
                      ? 'Investigation in progress. Document the corrective action plan to advance toward closure.'
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
                {satisfiedCount} of 4 Satisfied
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
                  <button onClick={onGoToInvestigation} className="text-primary hover:underline">
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
                  <button onClick={onGoToCorrectiveAction} className="text-primary hover:underline">
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
              disabled={isLocked}
              onChange={(e) => onChangeClosureNotes(e.target.value)}
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
                  onClick={onExecuteClosure}
                  disabled={isActionLoading || !hasRootCause || !hasCorrectiveAction || !hasEvidence}
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
