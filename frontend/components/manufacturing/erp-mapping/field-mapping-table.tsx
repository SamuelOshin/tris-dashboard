'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FieldMapping, PreviewData, TargetInfo } from './types'

const NOT_MAPPED = '__not_mapped__'

interface Props {
  target: TargetInfo
  preview: PreviewData
  mapping: FieldMapping
  defaults: FieldMapping
  onColumnChange: (field: string, column: string) => void
  onDefaultChange: (field: string, value: string) => void
}

function RequirementBadge({ required }: { required: boolean }) {
  return required ? (
    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
      Required
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Optional
    </span>
  )
}

/** One row per canonical field: choose the source column, or give a fixed value. */
export function FieldMappingTable(props: Props) {
  const { target, preview, mapping, defaults, onColumnChange, onDefaultChange } = props
  const sample = preview.sample_rows[0] ?? {}

  return (
    <section className="space-y-3 tris-surface p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">2. Match columns to TRIS fields</h2>
        <p className="text-xs text-muted-foreground">
          Required fields must be matched, or given a fixed value, before you can import.
          {target.any_of.length > 0 &&
            ` Each row also needs at least one of: ${target.any_of
              .map((g) => g.join(' / '))
              .join('; ')}.`}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">TRIS field</th>
              <th className="px-3 py-2 font-medium">Column in your file</th>
              <th className="px-3 py-2 font-medium">Example value</th>
              <th className="px-3 py-2 font-medium">Fixed value if no column</th>
            </tr>
          </thead>
          <tbody>
            {target.fields.map((field) => {
              const column = mapping[field.name]
              const unmatchedRequired = field.required && !column && !defaults[field.name]?.trim()
              return (
                <tr
                  key={field.name}
                  className={`border-t border-border align-top ${
                    unmatchedRequired ? 'bg-destructive/5' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{field.name}</span>
                      <RequirementBadge required={field.required} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={column ?? NOT_MAPPED}
                      onValueChange={(v) => onColumnChange(field.name, v === NOT_MAPPED ? '' : v)}
                    >
                      <SelectTrigger className="w-52" aria-label={`Column for ${field.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOT_MAPPED}>Not matched</SelectItem>
                        {preview.columns.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {column ? (sample[column] ?? '(empty)') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={defaults[field.name] ?? ''}
                      onChange={(e) => onDefaultChange(field.name, e.target.value)}
                      placeholder={field.default != null ? String(field.default) : 'None'}
                      aria-label={`Fixed value for ${field.name}`}
                      className="h-9 w-36"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
