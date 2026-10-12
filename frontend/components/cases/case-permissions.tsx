'use client'

import { Eye } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { canCloseCases, canRunHistory, canWorkCases } from '@/lib/permissions'

/** What the signed-in role may do on a case page. The server enforces it; this shows it up front. */
export function useCasePermissions() {
  const { user } = useAuth()
  return {
    canWork: canWorkCases(user?.role),
    canClose: canCloseCases(user?.role),
    canRunHistory: canRunHistory(user?.role),
  }
}

/** A short note at the top of a case tab for a role that cannot make changes. */
export function ViewOnlyNotice({
  title = 'View only.',
  children,
}: {
  title?: string
  children?: React.ReactNode
}) {
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground"
    >
      <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold text-foreground">{title}</span>{' '}
        {children ?? 'Your role can read this case but not change it.'}
      </p>
    </div>
  )
}
