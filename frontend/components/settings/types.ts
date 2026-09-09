import React from 'react'
import { RuleConfig } from '@/lib/api'

export type SettingsTabId = 'rules' | 'profile' | 'integrations'

export interface SettingsTabConfig {
  id: SettingsTabId
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

export interface RuleThresholdEntry {
  label: string
  value: string | number
}
