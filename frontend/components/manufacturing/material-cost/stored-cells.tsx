import { changeTone, formatMoney, formatPercent } from './material-cost-guards'
import type { StoredForecast, StoredExposure } from '../dashboard/types'

/** A stored forecast: the value and the change from the last price, or a plain note. */
export function ForecastCell({
  forecast,
  currency,
}: {
  forecast?: StoredForecast
  currency: string | null
}) {
  if (!forecast) return <span className="text-xs text-muted-foreground">Not run</span>
  return (
    <>
      <p className="tabular-nums text-foreground">{formatMoney(forecast.value, currency)}</p>
      <p className={`text-xs tabular-nums ${changeTone(forecast.change_pct)}`}>
        {formatPercent(forecast.change_pct)}
      </p>
    </>
  )
}

/** Projected exposure from the stored 90-day forecast; a plus sign means extra cost. */
export function ExposureCell({ exposure }: { exposure: StoredExposure | null | undefined }) {
  if (!exposure) return <span className="text-xs text-muted-foreground">No 90-day forecast</span>
  return (
    <>
      <p className={`tabular-nums ${changeTone(exposure.projected_exposure)}`}>
        {exposure.projected_exposure > 0 ? '+' : ''}
        {formatMoney(exposure.projected_exposure, exposure.currency)}
      </p>
      {exposure.exposure_pct != null && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatPercent(exposure.exposure_pct)}
        </p>
      )}
    </>
  )
}
