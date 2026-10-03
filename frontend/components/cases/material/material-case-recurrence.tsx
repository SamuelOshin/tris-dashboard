'use client'

import React from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { RiskCase } from '@/lib/api'
import { categoryLabel } from './material-case-guards'
import type { PriorCase } from './types'

/** Recurrence for a material-cost case: earlier cases on the same material or supplier. */
export function MaterialCaseRecurrence({ caseData }: { caseData: RiskCase }) {
  const prior = (caseData.prior_cases ?? []) as PriorCase[]
  return (
    <div className="max-w-3xl space-y-4 pt-2">
      <Card className="space-y-4 rounded-xl border border-border/80 bg-card p-5">
        <div>
          <h2 className="text-sm font-bold text-foreground">Recurrence</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Earlier cases for material {caseData.material_id}
            {caseData.supplier_id ? ` or supplier ${caseData.supplier_id}` : ''}.
          </p>
        </div>
        {prior.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            No earlier case for this material or supplier.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {prior.length} earlier case{prior.length === 1 ? '' : 's'} found
            </div>
            {prior.map((p) => (
              <div key={p.case_id} className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-foreground">{p.case_number}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {categoryLabel({ case_category: p.case_category })}
                  {p.material_id ? ` · ${p.material_id}` : ''}
                </p>
                {p.root_cause && <p className="text-muted-foreground">Root cause: {p.root_cause}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
