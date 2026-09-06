'use client'

import React from 'react'
import {
  ShieldAlert,
  Search,
  Wrench,
  FileCheck2,
  History,
  RefreshCw,
  Lock,
} from 'lucide-react'
import { TabId, TabConfig } from './types'
import { RiskCase } from '@/lib/api'
import {
  isInvestigationLocked,
  isCorrectiveLocked,
  isClosureLocked,
} from './case-workflow-guards'

export const WORKSPACE_TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: ShieldAlert },
  { id: 'investigation', label: 'Investigation', icon: Search },
  { id: 'corrective-action', label: 'Corrective Action', icon: Wrench },
  { id: 'closure', label: 'Closure', icon: FileCheck2 },
  { id: 'history', label: 'History', icon: History },
  { id: 'recurrence', label: 'Recurrence', icon: RefreshCw },
]

interface CaseTabNavProps {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
  caseData: RiskCase | null
}

export function CaseTabNav({
  activeTab,
  onSelectTab,
  caseData,
}: CaseTabNavProps) {
  const isInvLocked = isInvestigationLocked(caseData)
  const isCorrLocked = isCorrectiveLocked(caseData)
  const isClosLocked = isClosureLocked(caseData)

  const getLockIndicator = (tabId: TabId) => {
    if (caseData?.status === 'Closed') return null
    if (tabId === 'investigation' && isInvLocked) {
      return <Lock className="w-2.5 h-2.5 text-amber-500/80 ml-1" />
    }
    if (tabId === 'corrective-action' && isCorrLocked) {
      return <Lock className="w-2.5 h-2.5 text-muted-foreground/80 ml-1" />
    }
    if (tabId === 'closure' && isClosLocked) {
      return <Lock className="w-2.5 h-2.5 text-muted-foreground/80 ml-1" />
    }
    return null
  }

  return (
    <div className="flex border-b border-border/80 overflow-x-auto no-scrollbar gap-1 pt-1 bg-card/40 px-2 rounded-xl">
      {WORKSPACE_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-[1px] ${
              isActive
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-background/50 rounded-t-lg shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-t-lg'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {getLockIndicator(tab.id)}
          </button>
        )
      })}
    </div>
  )
}
