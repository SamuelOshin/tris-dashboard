'use client'

import { LABEL_TEXT, formatWhen } from '../admin-guards'
import type { Dataset, DatasetLabel } from '../types'

interface Props {
  datasets: Dataset[]
  busy: string | null
  onLabel: (id: string, label: DatasetLabel) => void
}

const OPTIONS: DatasetLabel[] = ['unlabelled', 'synthetic', 'authorized']

/** Every named dataset with what it holds, and the administrator's statement of what kind of data it is. */
export function DatasetsTab({ datasets, busy, onLabel }: Props) {
  if (datasets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        No named dataset has been imported yet. A dataset appears here when a file is imported with a dataset name.
      </p>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        TRIS cannot tell from the data whether it is synthetic or authorised, so the label is a statement made here and
        recorded in the audit log. A dataset starts as not labelled.
      </p>
      {datasets.map((d) => (
        <section key={d.dataset_id} className="tris-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{d.dataset_id}</h3>
              <p className="text-xs text-muted-foreground">
                {d.source_type}
                {d.registered_at ? ` · registered ${formatWhen(d.registered_at)} by ${d.registered_by}` : ' · imported before the registry existed'}
              </p>
            </div>
            <div className="grid gap-1">
              <label htmlFor={`label-${d.dataset_id}`} className="text-[11px] text-muted-foreground">
                What kind of data is this?
              </label>
              <select
                id={`label-${d.dataset_id}`}
                value={d.label}
                disabled={busy === `dataset:${d.dataset_id}`}
                onChange={(e) => onLabel(d.dataset_id, e.target.value as DatasetLabel)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {LABEL_TEXT[o]}
                  </option>
                ))}
              </select>
              {d.label_set_at && (
                <p className="text-[11px] text-muted-foreground">
                  Set {formatWhen(d.label_set_at)} by {d.label_set_by}
                </p>
              )}
            </div>
          </div>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Purchases from</dt>
              <dd className="font-medium text-foreground">{d.purchases_from ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Purchases to</dt>
              <dd className="font-medium text-foreground">{d.purchases_to ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Materials with purchases</dt>
              <dd className="font-medium tabular-nums text-foreground">{d.materials_with_purchases}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Records</dt>
              <dd className="font-medium text-foreground">
                {Object.entries(d.records).map(([k, v]) => `${v.toLocaleString()} ${k}`).join(' · ') || '—'}
              </dd>
            </div>
          </dl>
        </section>
      ))}
    </div>
  )
}
