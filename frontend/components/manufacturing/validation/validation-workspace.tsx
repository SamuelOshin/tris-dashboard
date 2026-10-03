'use client'

import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { formatDate, formatTimestamp } from '../material-cost/material-cost-guards'
import { useValidationWorkspace } from './hooks/use-validation-workspace'
import { HorizonResults } from './horizon-results'
import { ProblemsPanel } from './problems-panel'
import { RunForm } from './run-form'
import { RunList } from './run-list'
import { canRunValidation } from './validation-guards'

export function ValidationWorkspace() {
  const { user } = useAuth()
  const ws = useValidationWorkspace()

  if (ws.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Validation could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{ws.error}</p>
      </div>
    )
  }
  if (!ws.runs) return <Skeleton className="h-64 w-full" />
  const run = ws.detail

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Each check uses only records dated on or before its date, saves the forecast before looking at what happened,
        and keeps every run, including ones that did not finish or did badly.
      </p>
      {canRunValidation(user?.role) && (
        <RunForm value={ws.form} onChange={ws.setForm} running={ws.running} onStart={ws.start} />
      )}
      {ws.runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No validation has been run yet. It needs purchase history long enough to forecast from: at least 13 months
          for the 30-day outlook.
        </p>
      ) : (
        <RunList runs={ws.runs} selectedId={ws.selectedId} onSelect={ws.setSelectedId} />
      )}
      {ws.detailLoading && <Skeleton className="h-48 w-full" />}
      {run && !ws.detailLoading && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">{run.run_id}</p>
            <p>
              Saved {formatTimestamp(run.created_at)} · data up to {formatDate(run.data_end)} ·{' '}
              {run.config.cutoffs.length} dates from {formatDate(run.config.cutoffs[0])} to{' '}
              {formatDate(run.config.cutoffs[run.config.cutoffs.length - 1])} · risk weights version{' '}
              {run.versions.risk_weight_version}
            </p>
          </div>
          {run.status === 'incomplete' || !run.metrics ? (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <span>
                This run did not finish. What it saved is kept, but it has no results.
                {run.failure && <span className="mt-1 block text-xs text-muted-foreground">Reason: {run.failure.message}</span>}
              </span>
            </div>
          ) : (
            <>
              {Object.entries(run.metrics.by_horizon).map(([days, h]) => (
                <HorizonResults key={days} days={days} h={h} />
              ))}
              <ProblemsPanel run={run} />
              <section className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">Limitations</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {run.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}
