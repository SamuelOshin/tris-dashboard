import type { StoredResult } from '../dashboard/types'
import type { ScoreSummary } from '../risk-score/types'
import type { MaterialRow, Overview } from './types'

/**
 * CSV of the rows currently shown in the Material Cost table.
 *
 * Pure functions, no display formatting: numbers are written as plain numbers, so the file opens
 * correctly in a spreadsheet. Text that a spreadsheet could read as a formula is prefixed with an
 * apostrophe, and every field is quoted when it holds a comma, quote or line break.
 */

const HEADER = [
  'Material ID',
  'Description',
  'Category',
  'Currency',
  'Unit of measure',
  'Current unit cost',
  'Change last month (%)',
  'Change last 3 months (%)',
  'Vs standard cost (%)',
  '12-month spend',
  'Main supplier',
  'Main supplier share (%)',
  'Stock cover (days)',
  'Risk score',
  'Risk level',
  '30-day forecast',
  '30-day change (%)',
  '90-day forecast',
  '90-day change (%)',
  'Projected exposure, 90 days',
  'Signals',
  'Open case',
  'Data up to',
  'Calculated at',
]

export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'number' ? String(value) : value
  if (typeof value === 'string' && /^\s*[=+\-@]|^[\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCsv(
  rows: MaterialRow[],
  scores: Record<string, ScoreSummary>,
  results: Record<string, StoredResult>,
  overview: Pick<Overview, 'as_of' | 'computed_at'>
): string {
  const lines = [HEADER.map(csvField).join(',')]
  for (const row of rows) {
    const score = scores[row.material_id]
    const stored = results[row.material_id]
    const f30 = stored?.forecasts['30']
    const f90 = stored?.forecasts['90']
    const fields = [
      row.material_id,
      row.description,
      row.category,
      row.currency,
      row.unit_of_measure,
      row.latest_price,
      row.price_change_1m_pct,
      row.price_change_3m_pct,
      row.vs_standard_pct,
      row.spend_window_total,
      row.top_supplier,
      row.top_supplier_share_pct,
      row.coverage_days,
      score?.score,
      score?.level,
      f30?.value,
      f30?.change_pct,
      f90?.value,
      f90?.change_pct,
      stored?.exposure?.projected_exposure,
      row.signals
        .filter((s) => s.status === 'triggered')
        .map((s) => s.name)
        .join('; '),
      stored?.open_case?.case_number,
      overview.as_of,
      overview.computed_at,
    ]
    lines.push(fields.map(csvField).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

/** Save the text as a file in the browser. */
export function downloadCsv(filename: string, csv: string): void {
  // The byte order mark makes spreadsheets read the file as UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
