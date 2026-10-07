'use client'

import Link from 'next/link'
import { Factory } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { formatDate } from '../material-cost/material-cost-guards'
import { canViewManufacturing } from '../manufacturing-navigation'
import { useManufacturingSummary } from './hooks/use-manufacturing-summary'
import { RiskTrendChart } from './risk-trend-chart'
import { SummaryCards } from './summary-cards'
import { TopExposureTable } from './top-exposure-table'

function Heading({ asOf }: { asOf?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <Factory className="size-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">Material cost intelligence</h2>
      {asOf && <span className="text-xs text-muted-foreground">Data up to {formatDate(asOf)}</span>}
    </div>
  )
}

/** Manufacturing summary for the main dashboard. Shown only to roles that may see Manufacturing. */
export function ManufacturingSummary() {
  const { user } = useAuth()
  const allowed = canViewManufacturing(user?.role)
  const { summary, error, loading, retry } = useManufacturingSummary(allowed)
  if (!allowed) return null

  return (
    <section
      className="space-y-3"
      aria-label="Material cost intelligence summary"
      data-tour="mfg-summary"
    >
      <Heading asOf={summary?.as_of} />
      {loading ? (
        <Skeleton className="h-28 w-full" />
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">
            The material cost summary could not be loaded.
          </p>
          <Button className="mt-2" size="sm" variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : !summary?.has_data ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
          No manufacturing data has been imported yet.{' '}
          <Link href="/manufacturing/erp-mapping" className="font-medium text-primary hover:underline">
            Import data
          </Link>
        </div>
      ) : (
        <>
          <SummaryCards summary={summary} />
          <div className="grid gap-3 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <RiskTrendChart points={summary.risk_trend ?? []} />
            </div>
            <div className="xl:col-span-3">
              <TopExposureTable rows={summary.top_exposure ?? []} />
            </div>
          </div>
        </>
      )}
    </section>
  )
}
