import type { SignalSummary } from './types'

const MAX_VISIBLE = 3

/** Chips for the signals that fired; nothing is shown for clear or unmeasurable checks. */
export function SignalChips({ signals }: { signals: SignalSummary[] }) {
  const fired = signals.filter((s) => s.status === 'triggered')
  if (fired.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {fired.slice(0, MAX_VISIBLE).map((s) => (
        <span
          key={s.code}
          title={s.explanation}
          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
        >
          {s.name}
        </span>
      ))}
      {fired.length > MAX_VISIBLE && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          +{fired.length - MAX_VISIBLE} more
        </span>
      )}
    </div>
  )
}
