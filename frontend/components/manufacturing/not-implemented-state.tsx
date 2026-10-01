import { Lock } from 'lucide-react'
import type { ManufacturingNavItem } from './manufacturing-navigation'
import { ComingSoonBadge } from './coming-soon-badge'

/** Honest empty state: no figures, charts or sample data are rendered. */
export function NotImplementedState({ item }: { item: ManufacturingNavItem }) {
  const Icon = item.icon
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <h2 className="text-base font-semibold text-foreground">{item.name}</h2>
        <ComingSoonBadge />
      </div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {item.description}. This area is not available yet, so there is no data to show.
      </p>
    </div>
  )
}

export function PermissionDeniedState() {
  return (
    <div className="rounded-2xl border border-border bg-card/40 px-6 py-14 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Lock className="size-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">Access restricted</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Your account does not have access to Manufacturing. Contact your administrator if you
        need it.
      </p>
    </div>
  )
}
