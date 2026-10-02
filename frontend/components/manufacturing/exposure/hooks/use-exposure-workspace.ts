'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { exposureApi } from '../exposure-api'
import { NO_CHANGE, isNoChange, validateScenario } from '../exposure-guards'
import type { ExposureResponse, ScenarioInputs } from '../types'

function choicesFrom(data: ExposureResponse): Choices {
  const suppliers = (data.rollups?.supplier ?? [])
    .flatMap((b) => b.groups.map((g) => g.key))
    .filter((k, i, all) => k !== 'Unassigned' && all.indexOf(k) === i)
  return { materials: [...(data.materials ?? []), ...(data.not_available ?? [])], suppliers }
}

/** Loads exposure from the stored forecasts and, on request, the same figures under a what-if. */
/** Choices for the pickers, kept from the unfiltered view so picking one material keeps the rest. */
interface Choices {
  materials: { material_id: string; description: string }[]
  suppliers: string[]
}

export function useExposureWorkspace() {
  const [choices, setChoices] = useState<Choices>({ materials: [], suppliers: [] })
  const [horizon, setHorizon] = useState(30)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<ExposureResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ScenarioInputs>(NO_CHANGE)
  const [result, setResult] = useState<ExposureResponse | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let cancelled = false
    setBaseline(null)
    setResult(null)
    setError(null)
    exposureApi
      .baseline(horizon, materialId)
      .then((data) => {
        if (cancelled) return
        setBaseline(data)
        if (materialId === null) setChoices(choicesFrom(data))
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [horizon, materialId])

  const applyScenario = useCallback(async () => {
    const problem = validateScenario(draft)
    if (problem) return toast.error(problem)
    setRunning(true)
    try {
      setResult(await exposureApi.scenario(horizon, materialId, draft))
    } catch {
      /* the request layer already told the user what went wrong */
    } finally {
      setRunning(false)
    }
  }, [draft, horizon, materialId])

  const reset = () => {
    setDraft(NO_CHANGE)
    setResult(null)
  }

  return {
    choices, horizon, setHorizon, materialId, setMaterialId, baseline, error,
    draft, setDraft, result, running, applyScenario, reset,
    canApply: !isNoChange(draft) || draft.spot_premium_pct > 0,
  }
}
