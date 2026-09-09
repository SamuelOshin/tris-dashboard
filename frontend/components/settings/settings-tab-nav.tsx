'use client'

import React from 'react'
import { Sliders, UserCheck, Database } from 'lucide-react'
import { SettingsTabId, SettingsTabConfig } from './types'

export const SETTINGS_TABS: SettingsTabConfig[] = [
  { id: 'rules', label: 'Detection Rules & Weights', icon: Sliders, badge: 'Live API' },
  { id: 'profile', label: 'Account Profile', icon: UserCheck, badge: 'Active' },
  { id: 'integrations', label: 'Integrations', icon: Database, badge: 'Roadmap' },
]

interface SettingsTabNavProps {
  activeTab: SettingsTabId
  onSelectTab: (tabId: SettingsTabId) => void
}

export function SettingsTabNav({ activeTab, onSelectTab }: SettingsTabNavProps) {
  return (
    <div className="flex border-b border-border/80 gap-1.5 pb-px overflow-x-auto no-scrollbar">
      {SETTINGS_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-[1px] rounded-t-lg ${
              isActive
                ? 'border-primary text-primary bg-primary/5 shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                  isActive
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted/60 text-muted-foreground border-border/70'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
