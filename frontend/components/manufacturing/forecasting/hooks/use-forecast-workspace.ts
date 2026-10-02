'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { forecastApi } from '../forecast-api'
import { defaultHorizon } from '../forecast-guards'
import type { MaterialForecasts, MaterialList } from '../types'

/** Loads the material list, the selected material's forecasts, and runs new forecasts. */
export function useForecastWorkspace() {
  const [list, setList] = useState<MaterialList | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [data, setData] = useState<MaterialForecasts | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [activeHorizon, setActiveHorizon] = useState<number | null>(null)

  useEffect(() => {
    forecastApi
      .materials()
      .then((result) => {
        setList(result)
        if (result.materials.length > 0) setSelectedId(result.materials[0].material_id)
      })
      .catch((err: Error) => setListError(err.message))
  }, [])

  const show = useCallback((result: MaterialForecasts) => {
    setData(result)
    setActiveHorizon((current) =>
      result.horizons.some((h) => h.horizon_days === current && h.status === 'forecast')
        ? current
        : defaultHorizon(result.horizons)
    )
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    setData(null)
    forecastApi
      .forecasts(selectedId)
      .then((result) => !cancelled && show(result))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedId, show])

  const runForecast = async () => {
    if (!selectedId) return
    setRunning(true)
    try {
      const result = await forecastApi.run(selectedId)
      show(result)
      const made = result.horizons.filter((h) => h.status === 'forecast').length
      toast.success(made > 0 ? 'Forecast saved' : 'No forecast could be made from this history')
    } catch {
      /* the request layer already told the user what went wrong */
    } finally {
      setRunning(false)
    }
  }

  return {
    list, listError, selectedId, setSelectedId, data, loading, running, runForecast,
    activeHorizon, setActiveHorizon,
  }
}
