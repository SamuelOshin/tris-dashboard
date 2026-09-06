'use client'

import React from 'react'
import {
  Trash2,
  Sparkles,
  Lock,
  UserCheck,
  Search,
  CheckCircle2,
  Upload,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskCase } from '@/lib/api'
import { InvestigationFormData } from '../types'
import { isInvestigationLocked } from '../case-workflow-guards'

interface InvestigationTabProps {
  caseData: RiskCase
  formData: InvestigationFormData
  onChangeField: (field: keyof InvestigationFormData, value: string) => void
  onClearForm: () => void
  onAutofillSample: () => void
  onAcceptCase: () => Promise<any>
  onSave: () => Promise<any>
  isActionLoading: boolean
}

export function InvestigationTab({
  caseData,
  formData,
  onChangeField,
  onClearForm,
  onAutofillSample,
  onAcceptCase,
  onSave,
  isActionLoading,
}: InvestigationTabProps) {
  const isClosed = caseData.status === 'Closed'
  const isLocked = isInvestigationLocked(caseData)

  const {
    evidenceReviewed,
    findingDisposition,
    rootCauseCategory,
    rootCause,
    supportingEvidence,
  } = formData

  return (
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
              onClick={onAcceptCase}
              disabled={isActionLoading}
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
              disabled={isLocked}
              onChange={(e) => onChangeField('evidenceReviewed', e.target.value)}
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
              disabled={isLocked}
              onChange={(e) => onChangeField('findingDisposition', e.target.value)}
              placeholder="Enter specific finding (e.g. duplicate invoice entered due to manual data entry error; or unusual amount confirmed without approval)..."
              className="w-full p-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed disabled:opacity-75 disabled:bg-muted/20"
            />
          </div>

          {/* Root-Cause Category */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Root-Cause Category</label>
            <select
              value={rootCauseCategory}
              disabled={isLocked}
              onChange={(e) => onChangeField('rootCauseCategory', e.target.value)}
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
              disabled={isLocked}
              onChange={(e) => onChangeField('rootCause', e.target.value)}
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
                    onClick={() => onChangeField('supportingEvidence', '')}
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
                    onChangeField('supportingEvidence', 'invoice_comparison.png')
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
                onClick={onSave}
                disabled={isActionLoading || isLocked}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {isActionLoading
                  ? 'Saving...'
                  : caseData.status === 'Assigned'
                    ? 'Save & Begin Investigation'
                    : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
