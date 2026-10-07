'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, Factory } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { useMaterialResults } from '../dashboard/hooks/use-material-results'
import { useRiskScores } from '../risk-score/hooks/use-risk-scores'
import { canRunScoring } from '../risk-score/risk-guards'
import { buildCsv, downloadCsv } from './export-csv'
import { FilterBar } from './filter-bar'
import { useMaterialCostOverview } from './hooks/use-material-cost-overview'
import { hasActiveFilters } from './material-cost-guards'
import { MaterialDetailSheet } from './material-detail-sheet'
import { MaterialsTable } from './materials-table'
import { OverviewSummary } from './overview-summary'

function NoDataState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Factory className="size-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">No manufacturing data yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Material prices, trends and signals appear here once purchase records have been imported.
        Start by importing your material list and purchase lines.
      </p>
      <Button asChild className="mt-4">
        <Link href="/manufacturing/erp-mapping">Import data</Link>
      </Button>
    </div>
  )
}

/** Material Cost Intelligence overview. Conducts the hook and the presentation components. */
export function MaterialCostWorkspace() {
  const ws = useMaterialCostOverview()
  const { overview } = ws
  const { user } = useAuth()
  const risk = useRiskScores(overview?.as_of ?? '', ws.filters.dataset)
  const stored = useMaterialResults(overview?.as_of ?? '', ws.filters.dataset, risk.version)
  const [level, setLevel] = useState('')
  const deepLinked = useRef(false)

  // A link such as /manufacturing/material-cost?material=SOL-CELL-M10 opens that material once.
  useEffect(() => {
    if (!overview?.has_data || deepLinked.current) return
    deepLinked.current = true
    const wanted = new URLSearchParams(window.location.search).get('material')
    if (wanted) void ws.openMaterial(wanted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview?.has_data])

  const shown = useMemo(() => {
    const rows = overview?.materials ?? []
    if (!level) return rows
    return rows.filter((row) => (risk.scores[row.material_id]?.level ?? 'Not scored') === level)
  }, [overview, level, risk.scores])

  const exportTable = () => {
    if (!overview) return
    const day = (overview.as_of ?? '').slice(0, 10)
    downloadCsv(`material-cost-${day || 'all'}.csv`, buildCsv(shown, risk.scores, stored.results, overview))
  }

  if (ws.error && !overview) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">The overview could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{ws.error}</p>
        <Button className="mt-3" variant="outline" onClick={ws.retry}>
          Try again
        </Button>
      </div>
    )
  }
  if (!overview) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!overview.has_data && !hasActiveFilters(ws.filters) && !ws.filters.asOf) {
    return <NoDataState />
  }

  return (
    <div className="space-y-5">
      <OverviewSummary overview={overview} dataset={ws.filters.dataset} />
      <FilterBar
        filters={ws.filters}
        overview={overview}
        onChange={ws.updateFilter}
        onClear={() => {
          ws.clearFilters()
          setLevel('')
        }}
        level={level}
        onLevelChange={setLevel}
      />
      {overview.notice ? (
        <div className="tris-surface px-6 py-10 text-center text-sm text-muted-foreground">
          {overview.notice}
        </div>
      ) : shown.length === 0 ? (
        <div className="tris-surface px-6 py-10 text-center text-sm text-muted-foreground">
          No materials match these filters.
        </div>
      ) : (
        <div className={ws.loading ? 'space-y-3 opacity-60 transition-opacity' : 'space-y-3'}>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-xs text-muted-foreground">
              {canRunScoring(user?.role)
                ? 'Risk scores are saved calculations; each run keeps the earlier ones.'
                : `${shown.length} of ${overview.materials.length} materials shown`}
            </p>
            {canRunScoring(user?.role) && (
              <Button size="sm" variant="outline" onClick={risk.calculate} disabled={risk.running}>
                {risk.running ? 'Calculating...' : 'Calculate risk scores'}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={exportTable}>
              <Download />
              Export table (CSV)
            </Button>
          </div>
          <MaterialsTable
            rows={shown}
            scores={risk.scores}
            results={stored.results}
            onOpen={ws.openMaterial}
          />
        </div>
      )}
      <MaterialDetailSheet
        open={ws.selectedId !== null}
        loading={ws.detailLoading}
        detail={ws.detail}
        dataset={ws.filters.dataset}
        stored={ws.selectedId ? stored.results[ws.selectedId] : undefined}
        onRiskChanged={risk.refresh}
        onClose={() => ws.openMaterial(null)}
      />
    </div>
  )
}
