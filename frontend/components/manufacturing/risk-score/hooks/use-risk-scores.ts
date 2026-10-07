'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { riskApi } from '../risk-api'
import type { ScoreSummary } from '../types'

/** The newest stored score per material for the current date and dataset, and a way to refresh them. */
export function useRiskScores(asOf: string, dataset: string) {
  const [scores, setScores] = useState<Record<string, ScoreSummary>>({})
  const [running, setRunning] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    riskApi
      .scores(asOf, dataset)
      .then((list) => {
        if (!cancelled) setScores(Object.fromEntries(list.scores.map((s) => [s.material_id, s])))
      })
      .catch(() => {
        if (!cancelled) setScores({}) // never leave badges from another date or dataset on screen
      })
    return () => {
      cancelled = true
    }
  }, [asOf, dataset, version])

  const calculate = useCallback(async () => {
    setRunning(true)
    try {
      const result = await riskApi.run(asOf, dataset)
      setVersion((v) => v + 1)
      const skipped = result.not_scored.length
      const count = result.scored.length
      toast.success(
        `Scored ${count} ${count === 1 ? 'material' : 'materials'}` +
          (skipped ? `; ${skipped} without enough data` : '')
      )
    } catch {
      /* the request layer already told the user what went wrong */
    } finally {
      setRunning(false)
    }
  }, [asOf, dataset])

  return { scores, running, version, calculate, refresh: () => setVersion((v) => v + 1) }
}
