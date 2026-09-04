'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseFetchDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Generic data-fetching hook that standardizes the loading / error / data
 * lifecycle. Guarded against setting state on an unmounted component and
 * exposes a `refetch` to let users retry failed loads in place.
 */
export function useFetchData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): UseFetchDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (mountedRef.current) {
        setData(result)
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to load data')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    void load()

    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  return { data, loading, error, refetch: load }
}
