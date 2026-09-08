'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsTabNav } from '@/components/settings/settings-tab-nav'
import { DetectionRulesTab } from '@/components/settings/tabs/detection-rules-tab'
import { ProfileTab } from '@/components/settings/tabs/profile-tab'
import { useSettingsWorkspace } from '@/components/settings/hooks/use-settings-workspace'
import { SettingsTabId } from '@/components/settings/types'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('rules')

  const {
    rules,
    loading,
    error,
    updatingRuleCode,
    loadRules,
    refreshAll,
    handleUpdateRuleWeight,
    handleToggleRuleActive,
  } = useSettingsWorkspace()

  return (
    <DashboardLayout
      title="Settings & Governance"
      description="Manage detection rule configurations, scoring weights, and account profile."
      breadcrumbs={[
        { label: 'TRIS Studio', href: '/' },
        { label: 'Settings & Governance' },
      ]}
    >
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* System Telemetry & Refresh Header */}
        <SettingsHeader onRefresh={refreshAll} loading={loading} />

        {/* Tab Navigation */}
        <SettingsTabNav activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Tab 1: Detection Rules & Weights (Connected to GET/PATCH /api/v1/rules) */}
        {activeTab === 'rules' && (
          <DetectionRulesTab
            rules={rules}
            loading={loading}
            error={error}
            onRetry={loadRules}
            onUpdateWeight={handleUpdateRuleWeight}
            onToggleActive={handleToggleRuleActive}
            updatingRuleCode={updatingRuleCode}
          />
        )}

        {/* Tab 2: Account Profile (Connected to GET/PATCH /api/v1/auth/me) */}
        {activeTab === 'profile' && <ProfileTab />}
      </div>
    </DashboardLayout>
  )
}
