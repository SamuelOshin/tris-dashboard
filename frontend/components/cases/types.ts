import { ComponentType } from 'react'
import { RiskCase } from '@/lib/api'

export type TabId =
  | 'overview'
  | 'investigation'
  | 'corrective-action'
  | 'closure'
  | 'history'
  | 'recurrence'

export interface TabConfig {
  id: TabId
  label: string
  icon: ComponentType<{ className?: string }>
}

export interface InvestigationFormData {
  investigationNotes: string
  evidenceReviewed: string
  findingDisposition: string
  rootCauseCategory: string
  rootCause: string
  supportingEvidence: string
}

export interface CorrectiveActionFormData {
  actionTaken: string
  responsiblePerson: string
  targetCompletionDate: string
  completionDate: string
  evidenceOfAction: string
  actionStatus: string
  actionComments: string
}

export interface ClosureFormData {
  closureNotes: string
  root_cause: string
  corrective_action: string
  closure_type: string
  closure_evidence: string
  verified_by: string
  closure_date: string
  follow_up_requirement: string
  recurrence_monitoring: string
}

export interface CaseDraft {
  investigationNotes?: string
  evidenceReviewed?: string
  findingDisposition?: string
  rootCauseCategory?: string
  rootCause?: string
  supportingEvidence?: string
  actionTaken?: string
  responsiblePerson?: string
  targetCompletionDate?: string
  completionDate?: string
  evidenceOfAction?: string
  actionStatus?: string
  actionComments?: string
  closureNotes?: string
}
