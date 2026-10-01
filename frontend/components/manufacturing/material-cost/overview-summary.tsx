import { ComingSoonBadge } from '../coming-soon-badge'
import { formatDate, formatMoney, formatTimestamp } from './material-cost-guards'
import type { Overview } from './types'

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs font-medium text-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Headline counts and provenance (data date, calculation time), all taken from the response. */
export function OverviewSummary({ overview }: { overview: Overview }) {
  const summary = overview.summary
  if (!summary) return null
  const currency = summary.currencies.length === 1 ? summary.currencies[0] : null
  const perCurrency = Object.entries(summary.spend_by_currency)
    .map(([code, total]) => formatMoney(total, code))
    .join(' · ')
  const topSignals = Object.entries(summary.signals_by_code)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => {
      const name = overview.signal_catalog.find((s) => s.code === code)?.name ?? code
      return `${name} (${count})`
    })

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Materials shown"
          value={String(summary.materials_shown)}
          hint={`${summary.materials_total} analysed in total`}
        />
        <Tile
          label="With at least one signal"
          value={String(summary.materials_with_signals)}
          hint={topSignals.length ? `Most common: ${topSignals.join(', ')}` : 'No signals detected'}
        />
        <Tile
          label={`Spend, last ${summary.spend_window_days} days`}
          value={currency ? formatMoney(summary.spend_window_total, currency) : '—'}
          hint={currency ? undefined : perCurrency || 'Shown per material'}
        />
        <Tile
          label="Data up to"
          value={formatDate(overview.as_of)}
          hint={`Calculated ${formatTimestamp(overview.computed_at)}`}
        />
      </div>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Forecast cost, financial exposure and risk score will appear here once available:
        {overview.pending_capabilities.map((name) => (
          <span key={name} className="inline-flex items-center gap-1">
            {name} <ComingSoonBadge />
          </span>
        ))}
      </p>
    </section>
  )
}
