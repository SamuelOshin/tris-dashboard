import Link from 'next/link'
import { formatMoney } from '../material-cost/material-cost-guards'
import type { ManufacturingSummary } from './types'

function Card({
  title,
  children,
  note,
  href,
}: {
  title: string
  children: React.ReactNode
  note?: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="h-full tris-surface px-4 py-3 transition-colors hover:bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="mt-1.5">{children}</div>
        {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
      </div>
    </Link>
  )
}

function Big({ value }: { value: string }) {
  return <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
}

function Empty({ reason }: { reason: string }) {
  return <p className="text-sm text-muted-foreground">{reason}</p>
}

/** Amounts per currency; euro and dollar totals are never added together. */
function PerCurrency({
  amounts,
  signed = false,
}: {
  amounts: Record<string, number>
  signed?: boolean
}) {
  return (
    <div className="space-y-0.5">
      {Object.entries(amounts).map(([currency, value]) => (
        <p key={currency} className="text-2xl font-semibold tabular-nums text-foreground">
          {signed && value > 0 ? '+' : ''}
          {formatMoney(value, currency)}
        </p>
      ))}
    </div>
  )
}

/** The four headline figures of the manufacturing summary. */
export function SummaryCards({ summary }: { summary: ManufacturingSummary }) {
  const high = summary.high_risk!
  const exposure = summary.projected_exposure!
  const rising = summary.forecast_increase_30d!
  const concentration = summary.supplier_concentration!
  const hasExposure = Object.keys(exposure.by_currency).length > 0
  const hasConcentration = Object.keys(concentration.spend_by_currency).length > 0
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        title="High-risk materials"
        href="/manufacturing/material-cost"
        note={high.scored ? `${high.scored} of ${summary.materials_total} materials scored` : undefined}
      >
        {high.reason_empty ? (
          <Empty reason={high.reason_empty} />
        ) : (
          <Big value={String(high.count)} />
        )}
      </Card>
      <Card
        title={`Projected material-cost exposure, next ${exposure.horizon_days} days`}
        href="/manufacturing/forecasting"
        note={
          hasExposure
            ? `${exposure.materials_counted} materials with a stored forecast. A plus sign is extra cost.`
            : undefined
        }
      >
        {hasExposure ? (
          <PerCurrency amounts={exposure.by_currency} signed />
        ) : (
          <Empty reason={exposure.reason_empty ?? 'No exposure to show.'} />
        )}
      </Card>
      <Card
        title="Materials with a 30-day forecast increase"
        href="/manufacturing/forecasting"
        note={
          rising.forecasted ? `of ${rising.forecasted} materials with a 30-day forecast` : undefined
        }
      >
        {rising.reason_empty ? (
          <Empty reason={rising.reason_empty} />
        ) : (
          <Big value={String(rising.count)} />
        )}
      </Card>
      <Card
        title="Supplier concentration exposure"
        href="/manufacturing/material-cost"
        note={
          hasConcentration
            ? `Spend in the last ${concentration.spend_window_days} days on ${concentration.count} materials that depend on one supplier`
            : undefined
        }
      >
        {hasConcentration ? (
          <PerCurrency amounts={concentration.spend_by_currency} />
        ) : (
          <Empty reason="No material depends on a single supplier." />
        )}
      </Card>
    </div>
  )
}
