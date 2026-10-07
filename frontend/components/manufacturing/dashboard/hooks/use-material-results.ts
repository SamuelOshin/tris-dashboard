'use client'

import { useEffect, useState } from 'react'
import { dashboardApi } from '../dashboard-api'
import type { StoredResult } from '../types'

/** Stored forecasts, exposure and open cases per material for the table's date and dataset. */
export function useMaterialResults(asOf: string, dataset: string, version = 0) {
  const [results, setResults] = useState<Record<string, StoredResult>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!asOf) return
    let cancelled = false
    dashboardApi
      .materialResults(asOf, dataset)
      .then((data) => {
        if (!cancelled) setResults(data.materials)
      })
      .catch(() => {
        if (!cancelled) setResults({}) // never leave figures from another date or dataset on screen
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [asOf, dataset, version])

  return { results, loaded }
}
