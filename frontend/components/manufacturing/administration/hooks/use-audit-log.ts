'use client'

import { useEffect, useRef, useState } from 'react'
import { adminApi } from '../admin-api'
import type { AuditFilters, AuditPage } from '../types'

const EMPTY: AuditFilters = { event_type: '', actor: '', since: '', until: '', page: 0 }

/** One page of the audit trail for the current filters. */
export function useAuditLog() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY)
  const [data, setData] = useState<AuditPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const latest = useRef(0)

  useEffect(() => {
    const ticket = ++latest.current // only the newest request may update the screen
    setLoading(true)
    const timer = setTimeout(() => {
      adminApi
        .audit(filters)
        .then((page) => {
          if (ticket !== latest.current) return
          setData(page)
          setError(null)
        })
        .catch((err: Error) => ticket === latest.current && setError(err.message))
        .finally(() => ticket === latest.current && setLoading(false))
    }, filters.actor ? 250 : 0) // wait for typing to pause
    return () => clearTimeout(timer)
  }, [filters])

  /** Changing a filter goes back to the first page. */
  const update = (patch: Partial<AuditFilters>) => setFilters((f) => ({ ...f, page: 0, ...patch }))
  const goTo = (page: number) => setFilters((f) => ({ ...f, page }))
  const clear = () => setFilters(EMPTY)

  return { filters, data, error, loading, update, goTo, clear }
}
