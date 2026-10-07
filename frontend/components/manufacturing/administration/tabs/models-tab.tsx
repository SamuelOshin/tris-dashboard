'use client'

import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { formatWhen } from '../admin-guards'
import type { Configuration, ForecastModel } from '../types'

interface Props {
  config: Configuration
  busy: string | null
  onToggle: (model: ForecastModel, enabled: boolean) => void
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

/** Forecast models (switch off without losing history) and the fixed settings behind them. */
export function ModelsTab({ config, busy, onToggle }: Props) {
  const s = config.forecast_settings
  return (
    <div className="space-y-5">
      <section className="tris-surface p-5">
        <h3 className="text-sm font-semibold text-foreground">Forecast models</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          A model that is switched off is not used for new forecasts or validations. Forecasts already saved keep the
          model they were made with, and every change is recorded. The simple baseline models stay on: the others are
          only chosen when they beat the best baseline.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {config.forecast_models.map((m) => (
            <li key={m.code} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {m.name} <span className="font-mono text-[11px] text-muted-foreground">v{m.version}</span>{' '}
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    {m.kind === 'baseline' ? 'Baseline' : 'Regression'}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">{m.description}</p>
                {m.last_changed_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Last changed {formatWhen(m.last_changed_at)} by {m.last_changed_by}
                    {m.last_note ? ` · ${m.last_note}` : ''}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {m.enabled ? 'On' : 'Off'}
                <Switch
                  checked={m.enabled}
                  disabled={!m.can_be_disabled || busy === `model:${m.code}`}
                  onCheckedChange={(on) => onToggle(m, on)}
                  aria-label={`${m.name} ${m.enabled ? 'on' : 'off'}`}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section className="tris-surface p-5">
        <h3 className="text-sm font-semibold text-foreground">Forecast settings</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Setting label="Outlooks" value={s.horizons_days.map((d) => `${d}-day`).join(', ')} />
          <Setting
            label="Months of history needed"
            value={Object.entries(s.required_months).map(([d, m]) => `${m} (${d}-day)`).join(', ')}
          />
          <Setting label="Held-out months scored per model" value={String(s.origins_scored_per_model)} />
          <Setting label="Edge a regression needs over a baseline" value={`${Math.round(s.minimum_improvement_for_regression * 100)}%`} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{s.note}</p>
      </section>
    </div>
  )
}
