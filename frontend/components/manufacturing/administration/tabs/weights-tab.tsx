'use client'

import { InfoTip } from '@/components/onboarding/info-tip'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { BAND_LABELS, FACTOR_LABELS, buildConfig, formatWhen, validateWeights, weightTotal } from '../admin-guards'
import type { WeightConfig, WeightList } from '../types'

interface Props {
  list: WeightList
  saving: boolean
  onSave: (config: WeightConfig, note: string) => Promise<boolean>
}

const toNumber = (raw: string) => (raw === '' ? Number.NaN : Number(raw))

/** The active risk weights and bands, a form that saves a new version, and every earlier version. */
export function WeightsTab({ list, saving, onSave }: Props) {
  const active = list.versions.find((v) => v.is_active) ?? list.versions[0]
  const [weights, setWeights] = useState<Record<string, number>>(active.config.weights)
  const [bands, setBands] = useState<Record<string, number>>(active.config.bands)
  const [note, setNote] = useState('')

  useEffect(() => {
    setWeights(active.config.weights) // follow the active version after a save
    setBands(active.config.bands)
    setNote('')
  }, [active.version, active.config])

  const total = weightTotal(weights)
  const submit = async () => {
    const problem = validateWeights(weights, bands, note)
    if (problem) return toast.error(problem)
    await onSave(buildConfig(active.config, weights, bands), note.trim())
  }

  return (
    <div className="space-y-5">
      <section className="tris-surface p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          Risk score weights — version {active.version} is active
          <InfoTip term="weightVersion" />
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Saving creates a new version; earlier versions and every score already calculated stay as they were. Each
          score says which version it used. The scales and the minimum data coverage are kept from the active version.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(FACTOR_LABELS).map((code) => (
            <div key={code} className="grid gap-1">
              <label htmlFor={`w-${code}`} className="text-xs font-medium text-foreground">
                {FACTOR_LABELS[code]}
              </label>
              <Input
                id={`w-${code}`}
                type="number"
                min={0}
                step="any"
                value={Number.isNaN(weights[code]) ? '' : weights[code]}
                onChange={(e) => setWeights({ ...weights, [code]: toNumber(e.target.value) })}
              />
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs ${Math.abs(total - 100) < 1e-6 ? 'text-muted-foreground' : 'text-amber-600'}`}>
          Total {total.toFixed(1)} of 100
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['moderate', 'high', 'critical'] as const).map((key) => (
            <div key={key} className="grid gap-1">
              <label htmlFor={`b-${key}`} className="text-xs font-medium text-foreground">
                {BAND_LABELS[key]} (score)
              </label>
              <Input
                id={`b-${key}`}
                type="number"
                min={0}
                max={100}
                step="any"
                value={Number.isNaN(bands[key]) ? '' : bands[key]}
                onChange={(e) => setBands({ ...bands, [key]: toNumber(e.target.value) })}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-1">
          <label htmlFor="w-note" className="text-xs font-medium text-foreground">
            Why are the weights changing?
          </label>
          <Input id="w-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save as a new version'}
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              setWeights(active.config.weights)
              setBands(active.config.bands)
              setNote('')
            }}
          >
            Reset
          </Button>
        </div>
      </section>
      <section className="tris-surface p-5">
        <h3 className="text-sm font-semibold text-foreground">Versions</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Version</th>
                <th className="py-1.5 pr-3 font-medium">Saved</th>
                <th className="py-1.5 pr-3 font-medium">By</th>
                <th className="py-1.5 pr-3 font-medium">High from</th>
                <th className="py-1.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {list.versions.map((v) => (
                <tr key={v.version}>
                  <td className="py-1.5 pr-3 text-foreground">
                    {v.version}
                    {v.is_active ? ' (active)' : ''}
                  </td>
                  <td className="py-1.5 pr-3">{formatWhen(v.created_at)}</td>
                  <td className="py-1.5 pr-3">{v.created_by}</td>
                  <td className="py-1.5 pr-3">{v.config.bands.high}</td>
                  <td className="py-1.5">{v.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
