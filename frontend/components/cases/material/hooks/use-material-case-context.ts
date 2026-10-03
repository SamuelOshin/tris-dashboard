'use client'

import { useEffect, useState } from 'react'
import { request } from '@/lib/api'
import type { MaterialCaseContext } from '../types'

/** Loads what was known when a material-cost case was opened, and how the material scores now. */
export function useMaterialCaseContext(caseId: string) {
  const [context, setContext] = useState<MaterialCaseContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    request<MaterialCaseContext>(`/manufacturing/material-cases/${encodeURIComponent(caseId)}/context`)
      .then((data) => !cancelled && setContext(data))
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [caseId])

  return { context, loading, error }
}
