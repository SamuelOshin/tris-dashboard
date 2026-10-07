'use client'

import Link from 'next/link'
import { LineChart, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth-context'
import { formatDate, formatMonth, formatTimestamp } from '../material-cost/material-cost-guards'
import { ForecastChart } from './forecast-chart'
import { canRunForecast } from './forecast-guards'
import { HorizonCards } from './horizon-cards'
import { useForecastWorkspace } from './hooks/use-forecast-workspace'
import { ModelDetails } from './model-details'

function NoData() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <LineChart className="size-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">No purchase history yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Forecasts are made from monthly purchase prices. Import purchase records to get started.
      </p>
      <Button asChild className="mt-4">
        <Link href="/manufacturing/erp-mapping">Import data</Link>
      </Button>
    </div>
  )
}

export function ForecastWorkspace() {
  const { user } = useAuth()
  const ws = useForecastWorkspace()

  if (ws.listError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Forecasting could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{ws.listError}</p>
      </div>
    )
  }
  if (!ws.list) return <Skeleton className="h-64 w-full" />
  if (!ws.list.has_data || ws.list.materials.length === 0) return <NoData />

  const active = ws.data?.horizons.find((h) => h.horizon_days === ws.activeHorizon)
  const run = active?.run ?? null
  const anyRun = ws.data?.horizons.some((h) => h.status === 'forecast') ?? false

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="forecast-material" className="text-xs font-medium text-foreground">
            Material
          </label>
          <Select value={ws.selectedId} onValueChange={ws.setSelectedId}>
            <SelectTrigger id="forecast-material" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ws.list.materials.map((m) => (
                <SelectItem key={m.material_id} value={m.material_id}>
                  {m.description} · {m.material_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canRunForecast(user?.role) && (
          <Button onClick={ws.runForecast} disabled={ws.running || ws.loading}>
            <Play />
            {ws.running ? 'Running...' : anyRun ? 'Run again' : 'Run forecast'}
          </Button>
        )}
        {ws.data && (
          <p className="pb-2 text-xs text-muted-foreground">
            Based on purchases up to {formatDate(ws.data.as_of)} · {ws.data.usable_history_months}{' '}
            consecutive {ws.data.data_frequency} periods usable
            {ws.data.excluded_partial_month &&
              ` · ${formatMonth(ws.data.excluded_partial_month)} is incomplete and not used`}
          </p>
        )}
      </div>

      {ws.loading && <Skeleton className="h-64 w-full" />}
      {ws.data && !ws.loading && (
        <>
          <HorizonCards
            horizons={ws.data.horizons}
            currency={ws.data.currency}
            active={ws.activeHorizon}
            onSelect={ws.setActiveHorizon}
          />
          {run ? (
            <section className="space-y-2 tris-surface p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Price history and {run.horizon_days}-day forecast
              </h2>
              <ForecastChart history={ws.data.history} path={run.path} currency={ws.data.currency} />
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
              {anyRun
                ? 'Select an outlook above to see its chart.'
                : 'No forecast has been saved for this material and date yet.'}
            </p>
          )}
          {run && <ModelDetails run={run} />}
          {run && (
            <p className="text-xs text-muted-foreground">
              Saved {formatTimestamp(run.created_at)}. Re-running never changes an earlier forecast;
              it adds a new one.
            </p>
          )}
        </>
      )}
    </div>
  )
}
