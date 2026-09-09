'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  api,
  RiskCase,
  CaseTransitionPayload,
  enrichSignal,
} from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import {
  InvestigationFormData,
  CorrectiveActionFormData,
  CaseDraft,
} from '../types'

export function useCaseWorkspace(caseId: string) {
  const { user } = useAuth()

  const [caseData, setCaseData] = useState<RiskCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Investigation form state
  const [investigationForm, setInvestigationForm] = useState<InvestigationFormData>({
    investigationNotes: '',
    evidenceReviewed: '',
    findingDisposition: '',
    rootCauseCategory: '',
    rootCause: '',
    supportingEvidence: '',
  })

  // Corrective action form state
  const [correctiveForm, setCorrectiveForm] = useState<CorrectiveActionFormData>({
    actionTaken: '',
    responsiblePerson: '',
    targetCompletionDate: '',
    completionDate: '',
    evidenceOfAction: '',
    actionStatus: 'In Progress',
    actionComments: '',
  })

  // Closure state
  const [closureNotes, setClosureNotes] = useState('')
  const [closureForm, setClosureForm] = useState({
    closureType: '' as string,
    closureEvidence: '',
    followUpRequirement: '',
    recurrenceMonitoring: '',
    verifiedBy: '',
    closureDate: new Date().toISOString().split('T')[0],
  })
  const [closureValidationErrors, setClosureValidationErrors] = useState<string[]>([])

  // Audit trail sort order
  const [auditSortOrder, setAuditSortOrder] = useState<'desc' | 'asc'>('asc')

  const draftKey = `tris_case_draft_${caseId}`

  // Save drafts in localStorage when active fields change
  const saveDraftLocally = useCallback(
    (customDraft?: Partial<CaseDraft>) => {
      if (!caseData || caseData.status === 'Closed') return
      try {
        const draft: CaseDraft = {
          ...investigationForm,
          ...correctiveForm,
          closureNotes,
          closureType: closureForm.closureType,
          closureEvidence: closureForm.closureEvidence,
          followUpRequirement: closureForm.followUpRequirement,
          recurrenceMonitoring: closureForm.recurrenceMonitoring,
          verifiedBy: closureForm.verifiedBy,
          closureDate: closureForm.closureDate,
          ...customDraft,
        }
        localStorage.setItem(draftKey, JSON.stringify(draft))
      } catch (e) {
        // Ignore localStorage quota errors
      }
    },
    [caseData, draftKey, investigationForm, correctiveForm, closureNotes, closureForm]
  )

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey)
    } catch (e) {
      // Ignore
    }
  }, [draftKey])

  // Populate data
  const loadCase = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getCase(caseId)
      setCaseData(data)

      const isCaseClosed = data.status === 'Closed'

      if (isCaseClosed) {
        // Populate from database
        setInvestigationForm({
          investigationNotes: `Case investigated and closed on ${
            data.closure_date ? new Date(data.closure_date).toLocaleDateString() : 'Sep 06, 2026'
          }. Finding: ${data.root_cause || 'Documented.'}`,
          evidenceReviewed: data.closure_evidence
            ? `Primary evidence: ${data.closure_evidence}. Verified accounts payable ledger records.`
            : 'Accounts payable invoice record, vendor master audit log.',
          findingDisposition: data.root_cause || 'Exception verified and remediated.',
          rootCauseCategory: data.closure_type || 'Process Error / Data Entry',
          rootCause: data.root_cause || '',
          supportingEvidence: data.closure_evidence || '',
        })

        setCorrectiveForm({
          actionTaken: data.corrective_action || '',
          responsiblePerson: data.verified_by || data.assigned_to || 'Risk Reviewer / Case Owner',
          targetCompletionDate: data.closure_date ? data.closure_date.split('T')[0] : '',
          completionDate: data.closure_date ? data.closure_date.split('T')[0] : '',
          evidenceOfAction: data.closure_evidence || '',
          actionStatus: 'Completed',
          actionComments: data.corrective_action || 'Remediation completed. Payment stopped/reconciled.',
        })

        setClosureForm({
          closureType: data.closure_type || '',
          closureEvidence: data.closure_evidence || '',
          followUpRequirement: data.follow_up_requirement || '',
          recurrenceMonitoring: data.recurrence_monitoring || '',
          verifiedBy: data.verified_by || '',
          closureDate: data.closure_date ? data.closure_date.split('T')[0] : new Date().toISOString().split('T')[0],
        })

        setClosureNotes(
          `System-validated closure completed by ${data.verified_by || 'Reviewer'}. Monitoring active.`
        )
      } else {
        // Restore from draft if available
        try {
          const saved = localStorage.getItem(draftKey)
          if (saved) {
            const draft: CaseDraft = JSON.parse(saved)
            setInvestigationForm({
              investigationNotes: draft.investigationNotes || '',
              evidenceReviewed: draft.evidenceReviewed || '',
              findingDisposition: draft.findingDisposition || '',
              rootCauseCategory: draft.rootCauseCategory || '',
              rootCause: draft.rootCause || data.root_cause || '',
              supportingEvidence: draft.supportingEvidence || data.closure_evidence || '',
            })
            setCorrectiveForm({
              actionTaken: draft.actionTaken || data.corrective_action || '',
              responsiblePerson:
                draft.responsiblePerson || data.assigned_to || user?.name || 'Risk Reviewer / Case Owner',
              targetCompletionDate: draft.targetCompletionDate || '',
              completionDate: draft.completionDate || '',
              evidenceOfAction: draft.evidenceOfAction || data.closure_evidence || '',
              actionStatus: draft.actionStatus || 'In Progress',
              actionComments: draft.actionComments || '',
            })
            setClosureForm({
              closureType: draft.closureType || data.closure_type || '',
              closureEvidence: draft.closureEvidence || data.closure_evidence || '',
              followUpRequirement: draft.followUpRequirement || data.follow_up_requirement || '',
              recurrenceMonitoring: draft.recurrenceMonitoring || data.recurrence_monitoring || '',
              verifiedBy: draft.verifiedBy || data.verified_by || user?.name || '',
              closureDate: draft.closureDate || (data.closure_date ? data.closure_date.split('T')[0] : new Date().toISOString().split('T')[0]),
            })
            if (draft.closureNotes) setClosureNotes(draft.closureNotes)
          } else {
            // Seed defaults from case record
            if (data.root_cause) {
              setInvestigationForm((prev) => ({ ...prev, rootCause: data.root_cause || '' }))
            }
            if (data.corrective_action) {
              setCorrectiveForm((prev) => ({ ...prev, actionTaken: data.corrective_action || '' }))
            }
            setCorrectiveForm((prev) => ({
              ...prev,
              responsiblePerson: data.assigned_to || user?.name || 'Risk Reviewer / Case Owner',
            }))
            setClosureForm((prev) => ({
              ...prev,
              closureEvidence: data.closure_evidence || prev.closureEvidence,
              followUpRequirement: data.follow_up_requirement || prev.followUpRequirement,
              recurrenceMonitoring: data.recurrence_monitoring || prev.recurrenceMonitoring,
              verifiedBy: data.verified_by || user?.name || prev.verifiedBy,
            }))
          }
        } catch (e) {
          // Ignore
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load case details')
    } finally {
      setLoading(false)
    }
  }, [caseId, draftKey, user?.name])

  useEffect(() => {
    if (caseId) {
      loadCase()
    }
  }, [caseId, loadCase])

  // Field change dispatchers
  const updateInvestigationField = (
    field: keyof InvestigationFormData,
    value: string
  ) => {
    setInvestigationForm((prev) => {
      const next = { ...prev, [field]: value }
      saveDraftLocally(next)
      return next
    })
  }

  const updateCorrectiveField = (
    field: keyof CorrectiveActionFormData,
    value: string
  ) => {
    setCorrectiveForm((prev) => {
      const next = { ...prev, [field]: value }
      saveDraftLocally(next)
      return next
    })
  }

  const updateClosureNotes = (notes: string) => {
    setClosureNotes(notes)
    saveDraftLocally({ closureNotes: notes })
  }

  // Clear handlers
  const handleClearInvestigationForm = () => {
    setInvestigationForm({
      investigationNotes: '',
      evidenceReviewed: '',
      findingDisposition: '',
      rootCauseCategory: '',
      rootCause: '',
      supportingEvidence: '',
    })
    saveDraftLocally({
      investigationNotes: '',
      evidenceReviewed: '',
      findingDisposition: '',
      rootCauseCategory: '',
      rootCause: '',
      supportingEvidence: '',
    })
    toast.info('Investigation form cleared')
  }

  const handleClearCorrectiveForm = () => {
    setCorrectiveForm({
      actionTaken: '',
      responsiblePerson: user?.name ? `${user.name} (Risk Reviewer)` : 'Risk Reviewer / Case Owner',
      targetCompletionDate: '',
      completionDate: '',
      evidenceOfAction: '',
      actionStatus: 'In Progress',
      actionComments: '',
    })
    saveDraftLocally({
      actionTaken: '',
      responsiblePerson: '',
      targetCompletionDate: '',
      completionDate: '',
      evidenceOfAction: '',
      actionStatus: 'In Progress',
      actionComments: '',
    })
    toast.info('Corrective action form cleared')
  }

  // Generic transition handler
  const handleTransition = async (
    toStatus: string,
    extra: Partial<CaseTransitionPayload> = {}
  ) => {
    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const payload: CaseTransitionPayload = {
        to_status: toStatus,
        actor: user?.name || 'Risk Reviewer',
        note: `Status transition to ${toStatus}`,
        ...extra,
      }
      const updated = await api.transitionCase(caseId, payload)
      setCaseData(updated)
      setSuccessMessage(`Case transitioned to ${toStatus}`)
      toast.success('Case Status Updated', {
        description: `Case ${caseId} transitioned to ${toStatus}`,
      })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tris-notification-refresh'))
      }
      return updated
    } catch (err: any) {
      const errMsg = err.message || `Failed to transition case to ${toStatus}`
      setError(errMsg)
      toast.error('Action Failed', { description: errMsg })
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // Lifecycle transitions
  const handleAcceptCase = async () => {
    const actor = user?.name || 'Risk Reviewer'
    const updated = await handleTransition('Assigned', {
      assigned_to: actor,
      note: `Ownership accepted by ${actor} (Risk Reviewer)`,
    })
    setCorrectiveForm((prev) => ({ ...prev, responsiblePerson: actor }))
    saveDraftLocally({ responsiblePerson: actor })
    return updated
  }

  const handleStartInvestigation = async () => {
    return await handleTransition('Under Investigation', {
      note: 'Formal investigation initiated by reviewer',
    })
  }

  const handleSaveInvestigation = async () => {
    if (!investigationForm.rootCause.trim()) {
      setError('Please provide a Root Cause Explanation before saving.')
      toast.error('Root Cause Missing', {
        description: 'A documented root cause is required to advance the case.',
      })
      return
    }
    if (!investigationForm.findingDisposition.trim()) {
      setError('Please document your Finding / Disposition before saving.')
      toast.error('Finding Missing', {
        description: 'Document your finding disposition before proceeding.',
      })
      return
    }

    saveDraftLocally()

    if (caseData?.status === 'Assigned') {
      await handleTransition('Under Investigation', {
        note: `Investigation documented: ${investigationForm.findingDisposition}. Root Cause: ${investigationForm.rootCause}`,
      })
    } else if (caseData?.status === 'Under Investigation') {
      // Advance to Corrective Action — backend requires root_cause in payload to persist it
      await handleTransition('Corrective Action', {
        root_cause: investigationForm.rootCause,
        note: `Root cause documented: ${investigationForm.rootCause}. Finding: ${investigationForm.findingDisposition}`,
      })
    } else {
      toast.success('Investigation Draft Saved', {
        description: 'Investigation findings saved to your workspace.',
      })
    }
  }

  const handleSaveCorrectiveAction = async () => {
    if (!correctiveForm.actionTaken.trim()) {
      setError('Please specify the Action Taken before saving.')
      toast.error('Action Taken Required', {
        description: 'Specify remedial action taken or planned.',
      })
      return
    }

    saveDraftLocally()

    if (caseData?.status === 'Corrective Action') {
      // Advance to Pending Verification — backend requires corrective_action in payload
      await handleTransition('Pending Verification', {
        corrective_action: correctiveForm.actionTaken,
        note: `Remediation documented: ${correctiveForm.actionTaken} (Assigned to: ${correctiveForm.responsiblePerson})`,
      })
    } else {
      toast.success('Corrective Action Saved', {
        description: 'Remediation plan saved to your workspace.',
      })
    }
  }

  const handleAdvanceToVerification = async () => {
    if (!correctiveForm.actionTaken.trim() && !caseData?.corrective_action) {
      toast.error('Corrective Action Required', {
        description: 'Document the corrective action taken before advancing.',
      })
      return
    }
    return await handleTransition('Pending Verification', {
      corrective_action: correctiveForm.actionTaken || caseData?.corrective_action || '',
      note: 'Remediation completed. Advanced to Pending Verification.',
    })
  }

  const executeClosure = async () => {
    setClosureValidationErrors([])
    setError(null)

    const errors: string[] = []

    // All values must come from the DB record (set by prior transitions) or the current closure form
    const resolvedRootCause = caseData?.root_cause || ''
    const resolvedAction = caseData?.corrective_action || ''
    const resolvedEvidence = closureForm.closureEvidence.trim() || caseData?.closure_evidence || ''
    const resolvedClosureType = closureForm.closureType
    const resolvedFollowUp = closureForm.followUpRequirement.trim()
    const resolvedRecurrence = closureForm.recurrenceMonitoring.trim()
    const resolvedVerifiedBy = closureForm.verifiedBy.trim() || user?.name || ''
    const resolvedClosureDate = closureForm.closureDate

    if (!resolvedRootCause) errors.push('Root cause explanation is required (complete Investigation tab).')
    if (!resolvedAction) errors.push('Corrective action plan is required (complete Corrective Action tab).')
    if (!resolvedEvidence) errors.push('Closure evidence attachment or reference is required.')
    if (!resolvedClosureType) errors.push('Closure type must be selected.')
    if (!resolvedFollowUp) errors.push('Follow-up requirement must be specified.')
    if (!resolvedRecurrence) errors.push('Recurrence monitoring plan must be specified.')
    if (!resolvedVerifiedBy) errors.push('Verified by (reviewer name) is required.')
    if (!resolvedClosureDate) errors.push('Closure date is required.')

    if (errors.length > 0) {
      setClosureValidationErrors(errors)
      toast.error('Closure Incomplete', {
        description: `${errors.length} required field(s) must be completed before closing.`,
      })
      return
    }

    setActionLoading(true)
    try {
      const closurePayload: CaseTransitionPayload = {
        to_status: 'Closed',
        actor: user?.name || 'Risk Reviewer',
        note: closureNotes.trim() || 'System-validated closure completed successfully.',
        root_cause: resolvedRootCause,
        corrective_action: resolvedAction,
        closure_type: resolvedClosureType as any,
        closure_evidence: resolvedEvidence,
        verified_by: resolvedVerifiedBy,
        closure_date: resolvedClosureDate,
        follow_up_requirement: resolvedFollowUp,
        recurrence_monitoring: resolvedRecurrence,
      }

      const updated = await api.transitionCase(caseId, closurePayload)
      setCaseData(updated)
      setSuccessMessage('Case closed and verified successfully!')
      clearDraft()

      toast.success('Case Closed & Verified', {
        description: `Case ${caseId} has passed all 8 system-validated closure criteria.`,
      })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tris-notification-refresh'))
      }
      return updated
    } catch (err: any) {
      const errMsg = err.message || 'System-validated closure failed'
      setError(errMsg)
      toast.error('Closure Failed', { description: errMsg })
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopenCase = async (reason: string) => {
    setActionLoading(true)
    setError(null)
    try {
      const updated = await api.transitionCase(caseId, {
        to_status: 'Reopened',
        actor: user?.name || 'Risk Reviewer',
        note: reason,
      })
      setCaseData(updated)
      toast.success('Case Reopened', {
        description: `Case ${caseId} has been reopened for active reconciliation.`,
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tris-notification-refresh'))
      }
      return updated
    } catch (err: any) {
      const errMsg = err.message || 'Failed to reopen case'
      setError(errMsg)
      toast.error('Reopen Failed', { description: errMsg })
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // Autofill evaluation sample data
  const handleAutofillSample = () => {
    const enriched = (caseData?.trigger_signals || []).map((s) => enrichSignal(s))
    const primarySignal = enriched[0]
    const primaryRule = primarySignal?.rule_code || 'R-005'

    if (primaryRule === 'R-001' || primaryRule === 'R-002') {
      const nextInv: InvestigationFormData = {
        investigationNotes: `Verified ${caseData?.supplier_id || 'SUP-001'} historical baseline and approval hierarchy.`,
        evidenceReviewed: `Accounts payable invoice record for ${
          caseData?.supplier_id || 'SUP-001'
        }, vendor master bank change audit log, approval threshold policy, and off-hours ERP access logs.`,
        findingDisposition:
          'Unusual transaction amount confirmed ($104,000.00 vs $30,471.43 baseline mean = 3.41x deviation). Invoice lacked required Tier-2 authorization following recent vendor bank routing update.',
        rootCauseCategory: 'Approval Bypass / Threshold Breach',
        rootCause:
          'Invoice was processed above standard authorization threshold without required secondary approval following vendor bank details update.',
        supportingEvidence: 'po_threshold_verification.pdf',
      }
      const nextCorr: CorrectiveActionFormData = {
        actionTaken:
          'Payment disbursement put on hold. Tier-2 approval requested and obtained retroactively. ERP validation threshold lock enabled.',
        responsiblePerson: user?.name ? `${user.name} (Risk Reviewer)` : 'Risk Reviewer / Case Owner',
        targetCompletionDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        completionDate: new Date().toISOString().split('T')[0],
        evidenceOfAction: 'cfo_authorization_signoff.pdf',
        actionStatus: 'Completed',
        actionComments:
          'Hold confirmed with Treasury. Supplier account verified. Policy controls updated.',
      }
      setInvestigationForm(nextInv)
      setCorrectiveForm(nextCorr)
      setClosureNotes(
        'All 8 mandatory closure fields verified. ERP threshold lock re-enabled. Payment authorized and released.'
      )
      saveDraftLocally({ ...nextInv, ...nextCorr, closureNotes })
      toast.success('Sample Evaluation Data Loaded', {
        description: 'Context-specific baseline deviation sample populated.',
      })
    } else {
      const nextInv: InvestigationFormData = {
        investigationNotes: 'Duplicate invoice detected via automated rule R-005 evaluation.',
        evidenceReviewed: `Invoice disbursement register for ${
          caseData?.supplier_id || 'SUP-001'
        }, dual PO submissions, and automated OCR ingestion receipts.`,
        findingDisposition:
          'Duplicate billing identified: Invoice #INV-2024-089 was submitted twice within a 48-hour window under identical line-item amounts ($12,500.00).',
        rootCauseCategory: 'Process Error / Data Entry',
        rootCause:
          'Vendor accounts receivable submitted invoice via electronic portal and concurrently via automated email ingestion, creating dual records.',
        supportingEvidence: 'duplicate_invoice_scan.pdf',
      }
      const nextCorr: CorrectiveActionFormData = {
        actionTaken:
          'Duplicate invoice draft voided in accounting ledger. Primary original invoice flagged for single disbursement. Vendor notified of duplicate receipt.',
        responsiblePerson: user?.name ? `${user.name} (Risk Reviewer)` : 'Risk Reviewer / Case Owner',
        targetCompletionDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        completionDate: new Date().toISOString().split('T')[0],
        evidenceOfAction: 'ledger_void_receipt.pdf',
        actionStatus: 'Completed',
        actionComments:
          'Zero overpayment executed. Accounting ledger reconciled. Vendor confirmed resolution.',
      }
      setInvestigationForm(nextInv)
      setCorrectiveForm(nextCorr)
      setClosureNotes(
        'Duplicate entry voided. Supplier confirmed single payment receipt. Case enrolled in 90-day monitoring.'
      )
      saveDraftLocally({ ...nextInv, ...nextCorr, closureNotes })
      toast.success('Sample Evaluation Data Loaded', {
        description: 'Duplicate invoice reconciliation sample populated.',
      })
    }
  }

  // Computed signals
  const enrichedSignals = (caseData?.trigger_signals || []).map((s) => enrichSignal(s))
  const primarySignal = enrichedSignals[0]

  // Closure readiness — based purely on what is persisted in the DB record
  // Frontend local-form state must NOT influence these guards (it isn't validated by the server)
  const hasRootCause = Boolean(caseData?.root_cause)
  const hasCorrectiveAction = Boolean(caseData?.corrective_action)
  const hasEvidence = Boolean(
    caseData?.closure_evidence || closureForm.closureEvidence.trim()
  )

  const updateClosureField = (field: keyof typeof closureForm, value: string) => {
    setClosureForm((prev) => {
      const next = { ...prev, [field]: value }
      saveDraftLocally({ [field]: value })
      return next
    })
  }

  return {
    caseData,
    loading,
    error,
    successMessage,
    actionLoading,
    primarySignal,
    enrichedSignals,
    investigationForm,
    correctiveForm,
    closureNotes,
    closureForm,
    closureValidationErrors,
    auditSortOrder,
    hasRootCause,
    hasCorrectiveAction,
    hasEvidence,
    actions: {
      updateInvestigationField,
      updateCorrectiveField,
      updateClosureNotes,
      updateClosureField,
      handleClearInvestigationForm,
      handleClearCorrectiveForm,
      handleAutofillSample,
      handleAcceptCase,
      handleStartInvestigation,
      handleSaveInvestigation,
      handleSaveCorrectiveAction,
      handleAdvanceToVerification,
      executeClosure,
      handleReopenCase,
      toggleAuditSortOrder: () =>
        setAuditSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc')),
      refetch: loadCase,
    },
  }
}
