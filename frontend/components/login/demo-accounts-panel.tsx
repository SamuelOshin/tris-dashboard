'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { roleSummary } from '@/lib/permissions'
import { useDemoAccountsState } from './hooks/use-demo-accounts'

/**
 * "Sign in as" buttons for a demonstration deployment. The panel appears only when the server
 * offers demo roles; it holds no passwords, and the server signs the visitor in.
 */
export function DemoAccountsPanel({ redirectTo }: { redirectTo: string }) {
  const { status, accounts } = useDemoAccountsState()
  const { loginAsDemo } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  if (status === 'off') return null

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
      <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-busy={status === 'loading'}>
        {status === 'loading' && <DemoAccountsSkeleton />}
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
              <span className="mt-1 block text-xs text-muted-foreground/80">
                <span className="font-medium">Cannot:</span> {roleSummary(account.key).cannot.join('; ')}.
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Placeholder cards the size of the real ones, so nothing moves when the roles arrive. */
function DemoAccountsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} aria-hidden="true">
          <div className="h-full min-h-[8.1rem] animate-pulse space-y-2 rounded-xl border border-border bg-card px-3 py-2">
            <div className="h-3.5 w-1/2 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted/70" />
            <div className="h-3 w-4/5 rounded bg-muted/70" />
            <div className="h-3 w-3/5 rounded bg-muted/50" />
          </div>
        </li>
      ))}
      <li className="sr-only" role="status">
        Loading demo roles
      </li>
    </>
  )
}
