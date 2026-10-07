'use client'

import { useCallback, useEffect, useState } from 'react'
import { dashboardApi } from '../dashboard-api'
import type { ManufacturingSummary } from '../types'

/** The dashboard's manufacturing figures, loaded once; errors show a retry, never zeros. */
export function useManufacturingSummary(enabled: boolean) {
  const [summary, setSummary] = useState<ManufacturingSummary | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(enabled)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    dashboardApi
      .summary()
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  return { summary, error, loading, retry: load }
}
