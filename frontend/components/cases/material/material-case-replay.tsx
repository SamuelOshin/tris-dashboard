'use client'

import React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/components/manufacturing/exposure/exposure-guards'
import { formatDate, formatMoney } from '@/components/manufacturing/material-cost/material-cost-guards'
import { useMaterialCaseContext } from './hooks/use-material-case-context'
import { signedPoints } from './material-case-guards'

/** Historical Replay for a material-cost case: the state of the material on the day it was scored. */
export function MaterialCaseReplay({ caseId }: { caseId: string }) {
  const { context, loading, error } = useMaterialCaseContext(caseId)

  if (loading) return <Skeleton className="h-48 w-full" />
  if (error || !context) {
    return (
      <Card className="mx-auto max-w-lg space-y-2 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-sm font-bold text-foreground">Historical state could not be loaded</h3>
        <p className="text-xs text-muted-foreground">{error}</p>
      </Card>
    )
  }
  const { opened_from: opened, forecast, exposure, replay, current } = context

  return (
    <div className="space-y-5 pt-2">
      <Card className="space-y-2 rounded-xl border border-border/70 bg-card p-5">
        <h2 className="text-sm font-bold text-foreground">Historical Material State</h2>
        <p className="text-xs text-muted-foreground">
          {context.material.description} as scored on {formatDate(opened.as_of)}. Only information available on that
          date was used, and later data never changes this record.
        </p>
        <div className="flex items-center gap-2 text-xs">
          {replay.reproduced ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <span className="font-medium text-foreground">
            {replay.reproduced
              ? `Score reproduced: ${replay.recomputed_score.toFixed(1)} matches the saved ${replay.stored_score.toFixed(1)}`
              : `Score did not reproduce: ${replay.recomputed_score.toFixed(1)} against ${replay.stored_score.toFixed(1)}`}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{replay.note}</p>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="space-y-1 rounded-xl border border-border/70 bg-card p-4 text-xs">
          <p className="font-semibold text-foreground">Score when opened</p>
          <p className="text-xl font-semibold tabular-nums text-foreground">
            {opened.score.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">{opened.level}</span>
          </p>
          <p className="text-muted-foreground">
            Weights version {opened.weight_version} · {opened.data_coverage_pct.toFixed(0)}% of the weighting had data
          </p>
        </Card>
        <Card className="space-y-1 rounded-xl border border-border/70 bg-card p-4 text-xs">
          <p className="font-semibold text-foreground">Forecast used</p>
          {forecast ? (
            <>
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {formatMoney(forecast.forecast_value, forecast.currency)}
              </p>
              <p className="text-muted-foreground">
                {forecast.horizon_days}-day outlook · {forecast.model}
                {forecast.change_pct != null && ` · ${forecast.change_pct > 0 ? '+' : ''}${forecast.change_pct}% vs latest`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No forecast was stored for this date.</p>
          )}
        </Card>
        <Card className="space-y-1 rounded-xl border border-border/70 bg-card p-4 text-xs">
          <p className="font-semibold text-foreground">Exposure when opened</p>
          {exposure ? (
            <>
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {formatAmount(exposure.projected_exposure, exposure.currency)}
              </p>
              <p className="text-muted-foreground">over {exposure.horizon_days} days</p>
            </>
          ) : (
            <p className="text-muted-foreground">Not available without a stored forecast.</p>
          )}
        </Card>
      </div>

      <Card className="space-y-2 rounded-xl border border-border/70 bg-card p-5 text-xs">
        <h3 className="font-bold text-foreground">Factors on that date</h3>
        <ul className="space-y-1.5">
          {opened.factors.map((f) => (
            <li key={f.code} className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">{f.explanation}</span>
              <span className="shrink-0 tabular-nums text-foreground">
                {f.status === 'evaluated' ? `+${f.points.toFixed(1)}` : 'not used'}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-1 rounded-xl border border-border/70 bg-card p-5 text-xs">
        <h3 className="font-bold text-foreground">Since then</h3>
        {current ? (
          <p className="text-muted-foreground">
            The latest saved score is {current.score.toFixed(1)} ({current.level}) as of {formatDate(current.as_of)}:{' '}
            {signedPoints(current.change)} against the score the case was opened with.
          </p>
        ) : (
          <p className="text-muted-foreground">No newer score has been saved for this material.</p>
        )}
      </Card>
    </div>
  )
}
