'use client'

import { InfoTip } from '@/components/onboarding/info-tip'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RunRequest } from './types'

interface Props {
  value: RunRequest
  onChange: (next: RunRequest) => void
  running: boolean
  onStart: () => void
}

const toNumber = (raw: string) => (raw === '' ? Number.NaN : Number(raw))

function Field({ id, label, hint, children }: { id: string; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Settings for a new run. Every value is saved with the run, and the same cutoffs are used whatever the results. */
export function RunForm({ value, onChange, running, onStart }: Props) {
  const set = (patch: Partial<RunRequest>) => onChange({ ...value, ...patch })
  const toggle = (days: number) =>
    set({
      horizons_days: value.horizons_days.includes(days)
        ? value.horizons_days.filter((d) => d !== days)
        : [...value.horizons_days, days].sort((a, b) => a - b),
    })
  return (
    <section className="space-y-4 tris-surface p-5">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          Run a validation
          <InfoTip term="validation" />
        </h2>
        <p className="text-xs text-muted-foreground">
          Goes back to past dates, forecasts using only what was known then, saves each forecast, and only afterwards
          compares it with what happened. Every material and date is included.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="v-horizons" label="Outlooks" hint="Which forecasts to check.">
          <div className="flex gap-1" role="group" aria-label="Outlooks">
            {[30, 90].map((d) => (
              <Button key={d} size="sm" variant={value.horizons_days.includes(d) ? 'default' : 'outline'} onClick={() => toggle(d)}>
                {d} days
              </Button>
            ))}
          </div>
        </Field>
        <Field id="v-event" label="Risk event: price rise (%)" hint="A rise at least this big counts as a cost risk.">
          <Input
            id="v-event"
            type="number"
            step="any"
            value={Number.isNaN(value.event_threshold_pct) ? '' : value.event_threshold_pct}
            onChange={(e) => set({ event_threshold_pct: toNumber(e.target.value) })}
          />
        </Field>
        <Field id="v-alert" label="Warning score (optional)" hint="Blank uses the High band of the current risk weights.">
          <Input
            id="v-alert"
            type="number"
            step="any"
            placeholder="High band"
            value={value.alert_threshold == null || Number.isNaN(value.alert_threshold) ? '' : value.alert_threshold}
            onChange={(e) => set({ alert_threshold: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
        <Field id="v-step" label="Months between dates" hint="Larger gaps mean less overlap between cases.">
          <Input
            id="v-step"
            type="number"
            min={1}
            max={12}
            value={value.cutoff_step_months}
            onChange={(e) => set({ cutoff_step_months: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
          />
        </Field>
      </div>
      <div className="flex items-end gap-3">
        <div className="grid flex-1 gap-1.5">
          <label htmlFor="v-note" className="text-xs font-medium text-foreground">
            Note (optional)
          </label>
          <Input id="v-note" maxLength={500} value={value.note ?? ''} onChange={(e) => set({ note: e.target.value || null })} />
        </div>
        <Button onClick={onStart} disabled={running}>
          <Play /> {running ? 'Running...' : 'Run validation'}
        </Button>
      </div>
      {running && <p className="text-xs text-muted-foreground">This checks every material at every date and can take a minute.</p>}
    </section>
  )
}
