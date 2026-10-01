'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { materialCostApi } from '../material-cost-api'
import { EMPTY_FILTERS, type Filters, type MaterialDetail, type Overview } from '../types'

/** Loads the overview for the current filters and the detail of the selected material. */
export function useMaterialCostOverview() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MaterialDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const latestRequest = useRef(0)

  const load = useCallback(async (next: Filters) => {
    const ticket = ++latestRequest.current
    setLoading(true)
    setError(null)
    try {
      const data = await materialCostApi.overview(next)
      if (ticket === latestRequest.current) setOverview(data)
    } catch (err) {
      if (ticket === latestRequest.current) {
        setError(err instanceof Error ? err.message : 'The overview could not be loaded.')
      }
    } finally {
      if (ticket === latestRequest.current) setLoading(false)
    }
  }, [])

  // Text typed into the search box is applied after a short pause, other filters at once.
  useEffect(() => {
    const timer = setTimeout(() => void load(filters), filters.search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [filters, load])

  const updateFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const clearFilters = () => setFilters(EMPTY_FILTERS)

  const openMaterial = async (materialId: string | null) => {
    setSelectedId(materialId)
    setDetail(null)
    if (!materialId) return
    setDetailLoading(true)
    try {
      setDetail(await materialCostApi.detail(materialId, filters))
    } catch {
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return {
    filters, updateFilter, clearFilters, overview, loading, error, retry: () => load(filters),
    selectedId, detail, detailLoading, openMaterial,
  }
}
