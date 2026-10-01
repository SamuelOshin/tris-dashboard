import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorLogTable } from './error-log-table'
import { outcomeTitle, outcomeTone, type OutcomeTone } from './erp-mapping-guards'
import type { RunOutcome } from './types'

const TONE_STYLES: Record<OutcomeTone, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  danger: 'border-destructive/30 bg-destructive/5',
}

function ToneIcon({ tone }: { tone: OutcomeTone }) {
  if (tone === 'success') return <CheckCircle2 className="size-5 text-emerald-600" />
  if (tone === 'warning') return <AlertTriangle className="size-5 text-amber-600" />
  return <XCircle className="size-5 text-destructive" />
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

interface Props {
  outcome: RunOutcome
  /** Shown for a validation run so the user can go on to import. */
  onImport?: () => void
  importing?: boolean
}

/** Validation result or ingestion summary: counts, warnings, missing values and error log. */
export function ResultPanel({ outcome, onImport, importing }: Props) {
  const { summary } = outcome
  const tone = outcomeTone(outcome)
  const breaker = summary.circuit_breaker
  const missing = Object.entries(summary.missing_values)
  const acceptedLabel = summary.dry_run ? 'Rows ready to import' : 'Rows imported'

  return (
    <section className={`space-y-4 rounded-xl border p-5 ${TONE_STYLES[tone]}`}>
      <div className="flex items-start gap-3">
        <ToneIcon tone={tone} />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{outcomeTitle(outcome)}</h2>
          <p className="text-xs text-muted-foreground">
            {summary.target_label} · {summary.source_profile_label}
          </p>
        </div>
      </div>

      {breaker && (
        <div className="rounded-lg border border-destructive/30 bg-background p-3 text-sm">
          <p className="font-medium text-destructive">
            Stopped: {Math.round(breaker.ratio * 100)}% of rows were rejected (the limit is{' '}
            {Math.round(breaker.threshold * 100)}%). No data was saved.
          </p>
          {breaker.hint && <p className="mt-1 text-foreground">{breaker.hint}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Rows read" value={summary.rows_total} />
        <Stat label={acceptedLabel} value={summary.rows_accepted} />
        <Stat label="Rows rejected" value={summary.rows_rejected} />
        <Stat label="Duplicates skipped" value={summary.rows_duplicate} />
        <Stat label="Blank rows ignored" value={summary.rows_blank} />
      </div>

      {summary.warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Warnings</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-foreground">
            {summary.warnings.map((w) => (
              <li key={`${w.code}-${w.field}`}>
                {w.message} — {w.count.toLocaleString()} {w.count === 1 ? 'row' : 'rows'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(missing.length > 0 || summary.unmapped_optional_fields.length > 0) && (
        <div className="text-xs text-foreground">
          <h3 className="text-sm font-semibold">Missing values</h3>
          {missing.length > 0 && (
            <p className="mt-1">
              Empty cells in optional columns:{' '}
              {missing.map(([field, count]) => `${field} (${count})`).join(', ')}.
            </p>
          )}
          {summary.unmapped_optional_fields.length > 0 && (
            <p className="mt-1">
              Optional fields with no column: {summary.unmapped_optional_fields.join(', ')}.
            </p>
          )}
        </div>
      )}

      <ErrorLogTable
        entries={outcome.error_log}
        total={summary.errors_total}
        jobId={summary.dry_run ? null : outcome.job_id}
      />

      {onImport && tone !== 'danger' && (
        <Button onClick={onImport} disabled={importing || summary.rows_accepted === 0}>
          {importing ? 'Importing...' : `Import ${summary.rows_accepted.toLocaleString()} rows`}
        </Button>
      )}
    </section>
  )
}
