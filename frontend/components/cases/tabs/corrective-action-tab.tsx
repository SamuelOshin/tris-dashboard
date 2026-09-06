'use client'

import React from 'react'
import {
  Trash2,
  Sparkles,
  Lock,
  Wrench,
  Activity,
  FileCheck2,
  CheckCircle2,
  Upload,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RiskCase } from '@/lib/api'
import { CorrectiveActionFormData } from '../types'
import { isCorrectiveLocked } from '../case-workflow-guards'

interface CorrectiveActionTabProps {
  caseData: RiskCase
  formData: CorrectiveActionFormData
  onChangeField: (field: keyof CorrectiveActionFormData, value: string) => void
  onClearForm: () => void
  onAutofillSample: () => void
  onGoToInvestigation: () => void
  onSubmitForVerification: () => Promise<any>
  onGoToClosure: () => void
  onSave: () => Promise<any>
  isActionLoading: boolean
}

export function CorrectiveActionTab({
  caseData,
  formData,
  onChangeField,
  onClearForm,
  onAutofillSample,
  onGoToInvestigation,
  onSubmitForVerification,
  onGoToClosure,
  onSave,
  isActionLoading,
}: CorrectiveActionTabProps) {
  const isClosed = caseData.status === 'Closed'
  const isLocked = isCorrectiveLocked(caseData)

  const {
    actionTaken,
    responsiblePerson,
    targetCompletionDate,
    completionDate,
    evidenceOfAction,
    actionStatus,
    actionComments,
  } = formData

  return (
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
                disabled={isLocked}
                onClick={onClearForm}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isLocked}
                onClick={onAutofillSample}
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
                <p className="font-bold text-foreground">
                  Corrective Action Locked — Investigation Required
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Corrective actions can only be formulated after the initial investigation and root-cause analysis are documented.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={onGoToInvestigation}
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
              onClick={onSubmitForVerification}
              disabled={isActionLoading || !actionTaken.trim()}
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
              onClick={onGoToClosure}
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
              disabled={isLocked}
              onChange={(e) => onChangeField('actionTaken', e.target.value)}
              placeholder="Enter remedial actions taken (e.g. duplicate invoice deleted, payment blocked, supplier master record updated)..."
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
            />
          </div>

          {/* Responsible Person */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Responsible Person / Function</label>
            <Input
              value={responsiblePerson}
              disabled={isLocked}
              placeholder="e.g. Risk Reviewer / Case Owner"
              onChange={(e) => onChangeField('responsiblePerson', e.target.value)}
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
                disabled={isLocked}
                onChange={(e) => onChangeField('targetCompletionDate', e.target.value)}
                className="h-9 text-xs bg-card font-mono disabled:opacity-75 disabled:bg-muted/20"
              />
            </div>

            {/* Actual Completion Date */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Actual Completion Date</label>
              <Input
                type="date"
                value={completionDate}
                disabled={isLocked}
                onChange={(e) => onChangeField('completionDate', e.target.value)}
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
                    onClick={() => onChangeField('evidenceOfAction', '')}
                    className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ) : (
              <div
                className={`p-4 border-2 border-dashed rounded-lg text-center space-y-1 transition-colors ${
                  isLocked
                    ? 'border-border/40 opacity-50 cursor-not-allowed bg-muted/10'
                    : 'border-border cursor-pointer hover:border-primary/50'
                }`}
                onClick={() => {
                  if (!isLocked) {
                    onChangeField('evidenceOfAction', 'supplier_update.png')
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
              disabled={isLocked}
              onChange={(e) => onChangeField('actionStatus', e.target.value)}
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
              disabled={isLocked}
              onChange={(e) => onChangeField('actionComments', e.target.value)}
              placeholder="Enter summary comments on remediation result..."
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
            />
          </div>

          {!isClosed && (
            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                onClick={onSave}
                disabled={isActionLoading || isLocked}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {isActionLoading
                  ? 'Saving...'
                  : caseData.status === 'Under Investigation'
                    ? 'Save & Advance to Corrective Action'
                    : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
