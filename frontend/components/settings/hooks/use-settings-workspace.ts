'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, RuleConfig } from '@/lib/api'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

export function useSettingsWorkspace() {
  const { refreshUser } = useAuth()
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingRuleCode, setUpdatingRuleCode] = useState<string | null>(null)

  const loadRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getRules()
      setRules(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load detection rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const refreshAll = useCallback(async () => {
    toast.info('Refreshing settings from server...')
    await Promise.all([loadRules(), refreshUser()])
  }, [loadRules, refreshUser])

  const handleUpdateRuleWeight = async (ruleCode: string, newWeight: number) => {
    if (newWeight < 0 || newWeight > 100) {
      toast.error('Rule weight must be between 0 and 100 points')
      return
    }

    setUpdatingRuleCode(ruleCode)
    try {
      const updated = await api.updateRule(ruleCode, { weight: newWeight })
      setRules((prev) => prev.map((r) => (r.rule_code === ruleCode ? updated : r)))
      toast.success(`Rule ${ruleCode} updated`, {
        description: `Weight adjusted to ${newWeight} points (version ${updated.rule_version}).`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Unable to update rule ${ruleCode}`
      toast.error(`Rule ${ruleCode} update failed`, { description: msg })
      // Reload on failure to restore true database state
      void loadRules()
    } finally {
      setUpdatingRuleCode(null)
    }
  }

  const handleToggleRuleActive = async (ruleCode: string, currentActive: boolean) => {
    setUpdatingRuleCode(ruleCode)
    try {
      const updated = await api.updateRule(ruleCode, { is_active: !currentActive })
      setRules((prev) => prev.map((r) => (r.rule_code === ruleCode ? updated : r)))
      toast.success(`Rule ${ruleCode} ${!currentActive ? 'enabled' : 'disabled'}`, {
        description: `Now at version ${updated.rule_version}.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Unable to toggle rule ${ruleCode}`
      toast.error(`Rule ${ruleCode} toggle failed`, { description: msg })
      void loadRules()
    } finally {
      setUpdatingRuleCode(null)
    }
  }

  return {
    rules,
    loading,
    error,
    updatingRuleCode,
    loadRules,
    refreshAll,
    handleUpdateRuleWeight,
    handleToggleRuleActive,
  }
}
