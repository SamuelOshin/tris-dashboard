'use client'

import { useEffect, useState } from 'react'
import { api, type DemoAccount } from '@/lib/api'

export type DemoAccountsState =
  | { status: 'loading'; accounts: [] }
  | { status: 'ready'; accounts: DemoAccount[] }
  | { status: 'off'; accounts: [] }

/**
 * The demo roles on offer, with whether the answer has arrived yet. `off` means demo sign-in is
 * disabled or the server could not be reached.
 */
export function useDemoAccountsState(): DemoAccountsState {
  const [state, setState] = useState<DemoAccountsState>({ status: 'loading', accounts: [] })

  useEffect(() => {
    let cancelled = false
    api
      .demoAccounts()
      .then((data) => {
        if (cancelled) return
        setState(
          data.enabled && data.accounts.length > 0
            ? { status: 'ready', accounts: data.accounts }
            : { status: 'off', accounts: [] },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'off', accounts: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/** The demo roles on offer; empty while loading, when demo sign-in is off or the server cannot be reached. */
export function useDemoAccounts(): DemoAccount[] {
  return useDemoAccountsState().accounts
}
