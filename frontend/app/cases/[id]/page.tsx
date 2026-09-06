'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

// Modular feature components
import { TabId } from '@/components/cases/types'
import { CaseHeader } from '@/components/cases/case-header'
import { CaseTabNav } from '@/components/cases/case-tab-nav'
import { OverviewTab } from '@/components/cases/tabs/overview-tab'
import { InvestigationTab } from '@/components/cases/tabs/investigation-tab'
import { CorrectiveActionTab } from '@/components/cases/tabs/corrective-action-tab'
import { ClosureTab } from '@/components/cases/tabs/closure-tab'
import { HistoryTab } from '@/components/cases/tabs/history-tab'
import { RecurrenceTab } from '@/components/cases/tabs/recurrence-tab'
import { ReopenModal } from '@/components/cases/modals/reopen-modal'
import { useCaseWorkspace } from '@/components/cases/hooks/use-case-workspace'

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = params?.id as string

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [reopenModalOpen, setReopenModalOpen] = useState(false)

  const {
    caseData,
    loading,
    error,
    actionLoading,
    primarySignal,
    enrichedSignals,
    investigationForm,
    correctiveForm,
    closureNotes,
    closureValidationErrors,
    auditSortOrder,
    hasRootCause,
    hasCorrectiveAction,
    hasEvidence,
    actions,
  } = useCaseWorkspace(caseId)

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
        {/* Case Header & Quick Actions */}
        <CaseHeader
          caseData={caseData}
          ruleDescription={primarySignal?.rule_name}
          isActionLoading={actionLoading}
          onAcceptCase={actions.handleAcceptCase}
          onStartInvestigation={async () => {
            await actions.handleStartInvestigation()
            setActiveTab('investigation')
          }}
          onOpenReopenModal={() => setReopenModalOpen(true)}
        />

        {/* Tab Navigation */}
        <CaseTabNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          caseData={caseData}
        />

        {/* Feature Tabs */}
        {activeTab === 'overview' && (
          <OverviewTab
            caseData={caseData}
            primarySignal={primarySignal}
            enrichedSignals={enrichedSignals}
            onAcceptCase={actions.handleAcceptCase}
            onViewTimeline={() => setActiveTab('history')}
          />
        )}

        {activeTab === 'investigation' && (
          <InvestigationTab
            caseData={caseData}
            formData={investigationForm}
            onChangeField={actions.updateInvestigationField}
            onClearForm={actions.handleClearInvestigationForm}
            onAutofillSample={actions.handleAutofillSample}
            onAcceptCase={actions.handleAcceptCase}
            onSave={actions.handleSaveInvestigation}
            isActionLoading={actionLoading}
          />
        )}

        {activeTab === 'corrective-action' && (
          <CorrectiveActionTab
            caseData={caseData}
            formData={correctiveForm}
            onChangeField={actions.updateCorrectiveField}
            onClearForm={actions.handleClearCorrectiveForm}
            onAutofillSample={actions.handleAutofillSample}
            onGoToInvestigation={() => setActiveTab('investigation')}
            onSubmitForVerification={async () => {
              await actions.handleAdvanceToVerification()
              setActiveTab('closure')
            }}
            onGoToClosure={() => setActiveTab('closure')}
            onSave={actions.handleSaveCorrectiveAction}
            isActionLoading={actionLoading}
          />
        )}

        {activeTab === 'closure' && (
          <ClosureTab
            caseData={caseData}
            closureNotes={closureNotes}
            onChangeClosureNotes={actions.updateClosureNotes}
            hasRootCause={hasRootCause}
            hasCorrectiveAction={hasCorrectiveAction}
            hasEvidence={hasEvidence}
            supportingEvidence={investigationForm.supportingEvidence}
            evidenceOfAction={correctiveForm.evidenceOfAction}
            closureValidationErrors={closureValidationErrors}
            onGoToInvestigation={() => setActiveTab('investigation')}
            onGoToCorrectiveAction={() => setActiveTab('corrective-action')}
            onAdvanceToVerification={actions.handleAdvanceToVerification}
            onExecuteClosure={actions.executeClosure}
            isActionLoading={actionLoading}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            caseData={caseData}
            primarySignal={primarySignal}
            auditSortOrder={auditSortOrder}
            onToggleSortOrder={actions.toggleAuditSortOrder}
          />
        )}

        {activeTab === 'recurrence' && (
          <RecurrenceTab
            caseData={caseData}
            primarySignal={primarySignal}
            onViewSimilarCases={() => router.push('/risk-cases')}
          />
        )}

        {/* Reopen Case Modal */}
        <ReopenModal
          isOpen={reopenModalOpen}
          onClose={() => setReopenModalOpen(false)}
          onConfirm={actions.handleReopenCase}
          isLoading={actionLoading}
        />
      </div>
    </DashboardLayout>
  )
}
