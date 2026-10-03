'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { validationApi } from '../validation-api'
import { DEFAULT_REQUEST, validateRequest } from '../validation-guards'
import type { RunDetail, RunListItem, RunRequest } from '../types'

/** The saved runs, the selected run, and starting a new one. */
export function useValidationWorkspace() {
  const [runs, setRuns] = useState<RunListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [form, setForm] = useState<RunRequest>(DEFAULT_REQUEST)
  const [running, setRunning] = useState(false)
  const latest = useRef(0)

  const loadRuns = useCallback(() => {
    return validationApi
      .runs()
      .then((list) => {
        setRuns(list)
        setSelectedId((current) => current ?? list[0]?.run_id ?? null)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (!selectedId) return
    const ticket = ++latest.current // only the newest request may update the screen
    setDetailLoading(true)
    validationApi
      .run(selectedId)
      .then((d) => ticket === latest.current && setDetail(d))
      .catch(() => ticket === latest.current && setDetail(null))
      .finally(() => ticket === latest.current && setDetailLoading(false))
  }, [selectedId])

  const start = async () => {
    const problem = validateRequest(form)
    if (problem) return toast.error(problem)
    setRunning(true)
    try {
      const result = await validationApi.start(form)
      toast.success('Validation run saved')
      await loadRuns()
      setDetail(result)
      setSelectedId(result.run_id)
    } catch {
      /* the request layer already told the user what went wrong */
    } finally {
      setRunning(false)
    }
  }

  return { runs, error, selectedId, setSelectedId, detail, detailLoading, form, setForm, running, start }
}
