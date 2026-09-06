'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, UserCheck, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RiskCase } from '@/lib/api'
import {
  getPriorityBadgeStyle,
  getStatusBadgeStyle,
} from './case-workflow-guards'

interface CaseHeaderProps {
  caseData: RiskCase
  ruleDescription?: string
  isActionLoading: boolean
  onAcceptCase: () => Promise<any>
  onStartInvestigation: () => Promise<any>
  onOpenReopenModal: () => void
}

export function CaseHeader({
  caseData,
  ruleDescription,
  isActionLoading,
  onAcceptCase,
  onStartInvestigation,
  onOpenReopenModal,
}: CaseHeaderProps) {
  const isClosed = caseData.status === 'Closed'
  const priorityStyle = getPriorityBadgeStyle(caseData.priority)
  const statusStyle = getStatusBadgeStyle(caseData.status)

  const displayStatus = isClosed
    ? 'Closed'
    : caseData.status === 'New'
      ? 'Open'
      : caseData.status === 'Pending Verification'
        ? 'Pending Closure'
        : caseData.status

  return (
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
          <span
            className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider ${priorityStyle}`}
          >
            {caseData.priority} Priority
          </span>
          <span className={`px-3 py-1 rounded text-xs font-medium border ${statusStyle}`}>
            Status: {displayStatus}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 ml-9">
          {ruleDescription || caseData.rule_description || 'Risk exception detected'}
        </p>
      </div>

      {/* Quick Lifecycle Action Buttons */}
      <div className="flex items-center gap-2">
        {!caseData.assigned_to && caseData.status === 'New' && (
          <Button
            size="sm"
            onClick={onAcceptCase}
            disabled={isActionLoading}
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1" />
            Accept Case
          </Button>
        )}
        {caseData.status === 'Assigned' && (
          <Button
            size="sm"
            onClick={onStartInvestigation}
            disabled={isActionLoading}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Begin Investigation
          </Button>
        )}
        {isClosed && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenReopenModal}
            disabled={isActionLoading}
            className="text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reopen Case
          </Button>
        )}
      </div>
    </div>
  )
}
