'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { useDemoAccounts } from './hooks/use-demo-accounts'

/**
 * "Sign in as" buttons for a demonstration deployment. The panel appears only when the server
 * offers demo roles; it holds no passwords, and the server signs the visitor in.
 */
export function DemoAccountsPanel({ redirectTo }: { redirectTo: string }) {
  const accounts = useDemoAccounts()
  const { loginAsDemo } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  if (accounts.length === 0) return null

  const signIn = async (key: string, label: string) => {
    setBusy(key)
    try {
      await loginAsDemo(key)
      toast.success(`Signed in as ${label}`)
      router.push(redirectTo)
    } catch {
      toast.error('Demo sign-in is not available right now.')
      setBusy(null)
    }
  }

  return (
    <section
      aria-label="Demo accounts"
      className="mt-6 rounded-2xl border border-dashed border-border bg-muted/20 p-4"
    >
      <h2 className="text-sm font-semibold text-foreground">Demo environment: sign in as</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Everything here is synthetic test data. Pick a role to see what it can do.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {accounts.map((account) => (
          <li key={account.key}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => signIn(account.key, account.label)}
              className="h-full w-full rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <span className="block text-sm font-medium text-foreground">
                {busy === account.key ? 'Signing in...' : account.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {account.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
