'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { adminApi } from '../admin-api'
import type { Configuration, Dataset, DatasetLabel, MappingProfile, WeightConfig, WeightList } from '../types'

/** What the administration tabs show, and the changes an administrator can make. */
export function useAdministration() {
  const [config, setConfig] = useState<Configuration | null>(null)
  const [weights, setWeights] = useState<WeightList | null>(null)
  const [datasets, setDatasets] = useState<Dataset[] | null>(null)
  const [profiles, setProfiles] = useState<MappingProfile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [c, w, d, p] = await Promise.all([
        adminApi.configuration(),
        adminApi.weights(),
        adminApi.datasets(),
        adminApi.profiles(),
      ])
      setConfig(c)
      setWeights(w)
      setDatasets(d.datasets)
      setProfiles(p.profiles)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  /** Run a change, show one message, and refresh what the screens show. */
  const change = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(done)
      await loadAll()
      return true
    } catch {
      return false // the request layer already told the user what went wrong
    } finally {
      setBusy(null)
    }
  }

  return {
    config,
    weights,
    datasets,
    profiles,
    error,
    busy,
    reload: loadAll,
    setModel: (code: string, enabled: boolean, note: string | null) =>
      change(`model:${code}`, () => adminApi.setModel(code, enabled, note), enabled ? 'Model switched on' : 'Model switched off'),
    setLabel: (id: string, label: DatasetLabel) =>
      change(`dataset:${id}`, () => adminApi.setDatasetLabel(id, label), 'Dataset label saved'),
    saveWeights: (next: WeightConfig, note: string) =>
      change('weights', () => adminApi.saveWeights(next, note), 'Risk weights saved as a new version'),
    deleteProfile: (id: string) => change(`profile:${id}`, () => adminApi.deleteProfile(id), 'Mapping deleted'),
  }
}
