'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PreviewData } from './types'

interface Props {
  preview: PreviewData
  onSheetChange: (sheet: string) => void
}

/** The column and sample-row preview shown before any mapping is committed. */
export function SourcePreview({ preview, onSheetChange }: Props) {
  return (
    <section className="space-y-3 tris-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Source file preview</h2>
          <p className="text-xs text-muted-foreground">
            {preview.filename} · {preview.total_rows.toLocaleString()} data rows ·{' '}
            {preview.columns.length} columns
            {preview.malformed_rows > 0 && ` · ${preview.malformed_rows} malformed rows`}
          </p>
        </div>
        {preview.sheets.length > 1 && (
          <Select value={preview.selected_sheet ?? ''} onValueChange={onSheetChange}>
            <SelectTrigger className="w-48" aria-label="Worksheet">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {preview.sheets.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {preview.columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.sample_rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {preview.columns.map((c) => (
                  <td key={c} className="whitespace-nowrap px-3 py-1.5 font-mono text-foreground">
                    {row[c] ?? <span className="text-muted-foreground">(empty)</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
