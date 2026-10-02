'use client'

import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '../material-cost/material-cost-guards'
import { ExposureSummary } from './exposure-summary'
import { ExposureTable } from './exposure-table'
import { useExposureWorkspace } from './hooks/use-exposure-workspace'
import { RollupTabs } from './rollup-tabs'
import { ScenarioPanel } from './scenario-panel'

const ALL = '__all'

export function ExposureWorkspace() {
  const ws = useExposureWorkspace()
  const { baseline } = ws
  if (ws.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Exposure could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{ws.error}</p>
      </div>
    )
  }
  if (!baseline) return <Skeleton className="h-64 w-full" />
  if (!baseline.has_data) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        No purchase history yet. Import purchase records and run a forecast to see financial exposure.
      </p>
    )
  }

  const shown = ws.result ?? baseline
  const isScenario = shown.kind === 'scenario'
  const materials = shown.materials ?? []
  const missing = baseline.not_available ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="exposure-material" className="text-xs font-medium text-foreground">
            Material
          </label>
          <Select value={ws.materialId ?? ALL} onValueChange={(v) => ws.setMaterialId(v === ALL ? null : v)}>
            <SelectTrigger id="exposure-material" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All materials</SelectItem>
              {ws.choices.materials.map((m) => (
                <SelectItem key={m.material_id} value={m.material_id}>
                  {m.description} · {m.material_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1" role="group" aria-label="Outlook">
          {[30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={ws.horizon === d ? 'default' : 'outline'}
              onClick={() => ws.setHorizon(d)}
            >
              {d}-day outlook
            </Button>
          ))}
        </div>
        <p className="pb-2 text-xs text-muted-foreground">
          From stored forecasts · purchases up to {formatDate(baseline.as_of)}
        </p>
      </div>

      {isScenario && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm text-foreground"
        >
          <FlaskConical className="size-4 shrink-0 text-primary" />
          {shown.label}
        </div>
      )}

      {materials.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          No stored {ws.horizon}-day forecast to calculate from. Run a forecast on the Price forecast tab first.
        </p>
      ) : (
        <>
          <ExposureSummary blocks={shown.rollups?.category ?? []} isScenario={isScenario} />
          <ExposureTable rows={materials} isScenario={isScenario} />
          {shown.rollups && <RollupTabs rollups={shown.rollups} isScenario={isScenario} />}
        </>
      )}

      {missing.length > 0 && (
        <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            {missing.length} materials without a stored {ws.horizon}-day forecast
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {missing.map((m) => (
              <li key={m.material_id}>
                <span className="text-foreground">{m.description}</span>: {m.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {materials.length > 0 && (
        <ScenarioPanel
          value={ws.draft}
          onChange={ws.setDraft}
          suppliers={ws.choices.suppliers}
          running={ws.running}
          canApply={ws.canApply}
          onApply={ws.applyScenario}
          onReset={ws.reset}
        />
      )}
    </div>
  )
}
