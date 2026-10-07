import Link from 'next/link'
import {
  changeTone,
  formatDate,
  formatMoney,
  formatMonth,
  formatPercent,
  formatTimestamp,
} from './material-cost-guards'
import type { StoredForecast, StoredResult } from '../dashboard/types'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums text-foreground">{children}</dd>
    </div>
  )
}

function Horizon({ days, forecast }: { days: number; forecast?: StoredForecast }) {
  if (!forecast) {
    return (
      <div className="rounded-lg border border-border p-3 text-sm">
        <p className="font-medium text-foreground">{days}-day outlook</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Not run for this date. Run it on the Forecasting &amp; Scenarios page.
        </p>
      </div>
    )
  }
  const range =
    forecast.lower != null && forecast.upper != null
      ? `${formatMoney(forecast.lower, forecast.currency)} to ${formatMoney(forecast.upper, forecast.currency)}`
      : 'Not provided by this model'
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <p className="font-medium text-foreground">{days}-day outlook</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {formatMoney(forecast.value, forecast.currency)}{' '}
        <span className={`text-xs font-medium ${changeTone(forecast.change_pct)}`}>
          {formatPercent(forecast.change_pct)}
        </span>
      </p>
      <dl className="mt-2 space-y-1 text-xs">
        <Row label="Range">{range}</Row>
        <Row label="For">{formatMonth(forecast.forecast_month)}</Row>
        <Row label="Model">
          {forecast.model} v{forecast.model_version}
        </Row>
        <Row label="Forecast made">{formatTimestamp(forecast.stored_at)}</Row>
        <Row label="Dataset version">
          <span className="font-mono">{forecast.dataset_version.slice(0, 16)}</span>
        </Row>
      </dl>
    </div>
  )
}

/** The stored 30- and 90-day forecasts and the 90-day exposure for a material (read only). */
export function StoredForecastSection({
  stored,
  asOf,
}: {
  stored?: StoredResult
  asOf: string
}) {
  const exposure = stored?.exposure
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Forecast and exposure</h3>
      <p className="text-xs text-muted-foreground">
        Stored results for data up to {formatDate(asOf)}. Nothing here is recalculated.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Horizon days={30} forecast={stored?.forecasts['30']} />
        <Horizon days={90} forecast={stored?.forecasts['90']} />
      </div>
      {exposure ? (
        <dl className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <Row label="Spend at the last price">
            {formatMoney(exposure.baseline_spend, exposure.currency)}
          </Row>
          <Row label="Spend at the forecast price">
            {formatMoney(exposure.forecast_spend, exposure.currency)}
          </Row>
          <Row label="Projected exposure, 90 days">
            <span className={changeTone(exposure.projected_exposure)}>
              {exposure.projected_exposure > 0 ? '+' : ''}
              {formatMoney(exposure.projected_exposure, exposure.currency)}
            </span>
          </Row>
          {exposure.stale_note && (
            <p className="pt-1 text-xs text-amber-600 dark:text-amber-400">{exposure.stale_note}</p>
          )}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">
          No 90-day forecast is stored, so there is no projected exposure to show.
        </p>
      )}
      <Link
        href="/manufacturing/forecasting"
        className="inline-block text-xs font-medium text-primary hover:underline"
      >
        Open Forecasting &amp; Scenarios
      </Link>
    </section>
  )
}
