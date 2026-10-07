'use client'

import { useEffect, useState } from 'react'
import { api, type DemoAccount } from '@/lib/api'

/** The demo roles on offer; empty when demo sign-in is off or the server cannot be reached. */
export function useDemoAccounts(): DemoAccount[] {
  const [accounts, setAccounts] = useState<DemoAccount[]>([])

  useEffect(() => {
    let cancelled = false
    api
      .demoAccounts()
      .then((data) => {
        if (!cancelled && data.enabled) setAccounts(data.accounts)
      })
      .catch(() => {
        /* no panel is shown when the list cannot be read */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return accounts
}
