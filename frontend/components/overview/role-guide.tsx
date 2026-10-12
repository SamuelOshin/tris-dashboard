'use client'

import { Check, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { roleSummary } from '@/lib/permissions'

/** A short card on the dashboard: what the signed-in role can and cannot do. */
export function RoleGuide() {
  const { user } = useAuth()
  if (!user) return null
  const summary = roleSummary(user.role)
  return (
    <Card className="p-4 sm:p-5" aria-label="What your role can do">
      <h2 className="text-sm font-semibold text-foreground">
        What you can do as {summary.label}
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <ul className="space-y-1.5" aria-label="You can">
          {summary.can.map((item) => (
            <li key={item} className="flex gap-2 text-xs text-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
              <span>
                <span className="sr-only">You can: </span>
                {item}
              </span>
            </li>
          ))}
        </ul>
        <ul className="space-y-1.5" aria-label="You cannot">
          {summary.cannot.map((item) => (
            <li key={item} className="flex gap-2 text-xs text-muted-foreground">
              <Minus className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">You cannot: </span>
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
