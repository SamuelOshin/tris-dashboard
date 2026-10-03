'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { formatTimestamp } from '../material-cost/material-cost-guards'
import { barWidth, canRunScoring } from './risk-guards'
import { MaterialCaseAction } from './material-case-action'
import { RiskBadge } from './risk-badge'
import { riskApi } from './risk-api'
import type { FactorScore, MaterialScores } from './types'

interface Props {
  materialId: string
  asOf: string
  dataset: string
  onChanged: () => void
}

function Factor({ f }: { f: FactorScore }) {
  const used = f.status === 'evaluated'
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-foreground">{f.name}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {used ? `+${f.points.toFixed(1)} points` : 'Not used'}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth(f.points, f.effective_weight_pct)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{f.explanation}</p>
      {used && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Weight {f.weight} of 100 · counts for {f.effective_weight_pct.toFixed(0)}% of this score
        </p>
      )}
    </li>
  )
}

/** Risk score for one material with the factor-by-factor reasons behind it. */
export function RiskScoreSection({ materialId, asOf, dataset, onChanged }: Props) {
  const { user } = useAuth()
  const [data, setData] = useState<MaterialScores | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const latest = useRef(0)

  const load = useCallback(() => {
    const ticket = ++latest.current // only the newest request may update the screen
    setLoading(true)
    return riskApi
      .material(materialId, asOf, dataset)
      .then((result) => ticket === latest.current && setData(result))
      .catch(() => ticket === latest.current && setData(null))
      .finally(() => ticket === latest.current && setLoading(false))
  }, [materialId, asOf, dataset])

  useEffect(() => {
    setRefusal(null)
    void load()
  }, [load])

  const calculate = async () => {
    setRunning(true)
    try {
      const result = await riskApi.run(asOf, dataset, materialId)
      const reason = result.not_scored[0]?.reason ?? null
      setRefusal(result.scored.length ? null : reason)
      if (result.scored.length) toast.success('Risk score saved')
      else toast.error('This material could not be scored')
      await load()
      onChanged()
    } catch {
      /* the request layer already told the user what went wrong */
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <Skeleton className="h-24 w-full" />
  const current = data?.current ?? null
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground">Risk score</h3>
        <RiskBadge score={current ?? undefined} />
        {canRunScoring(user?.role) && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={calculate} disabled={running}>
            {running ? 'Calculating...' : current ? 'Calculate again' : 'Calculate score'}
          </Button>
        )}
      </div>
      {current ? (
        <>
          <p className="text-sm text-foreground">{current.summary}</p>
          {canRunScoring(user?.role) && <MaterialCaseAction score={current} />}
          <ul className="space-y-2">
            {current.factors.map((f) => (
              <Factor key={f.code} f={f} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Saved {formatTimestamp(current.created_at)} · weights version {current.weight_version} ·{' '}
            {current.data_coverage_pct.toFixed(0)}% of the weighting had data. Each calculation is kept; earlier
            scores never change.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {refusal ?? 'No risk score has been calculated for this material and date yet.'}
        </p>
      )}
    </section>
  )
}
