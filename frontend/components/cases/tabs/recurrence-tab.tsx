'use client'

import React from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RiskCase } from '@/lib/api'

interface RecurrenceTabProps {
  caseData: RiskCase
  primarySignal: any
  onViewSimilarCases: () => void
}

export function RecurrenceTab({
  caseData,
  primarySignal,
  onViewSimilarCases,
}: RecurrenceTabProps) {
  const hasPriorCases =
    caseData.prior_cases && caseData.prior_cases.length > 0

  return (
    <div className="space-y-6 pt-2">
      <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4 max-w-3xl">
        <div>
          <h2 className="text-sm font-bold text-foreground">Recurrence Monitoring</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            TRIS continuously monitors post-closure transactions for pattern recurrence (Rule R-006).
          </p>
        </div>

        <div className="space-y-3 text-xs divide-y divide-border/40">
          <div className="flex justify-between items-center pt-2">
            <span className="text-muted-foreground font-medium">Recurrence Status</span>
            {!hasPriorCases ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <div>
                  <span>No Recurrence Detected</span>
                  <p className="text-[10px] font-normal text-muted-foreground">
                    TRIS has not detected this type of issue again since closure.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>{caseData.prior_cases!.length} Prior Similar Case(s) Detected</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-3">
            <span className="text-muted-foreground font-medium">Monitoring Window</span>
            <span className="font-mono text-foreground">90 Days Post-Closure (Rule R-006)</span>
          </div>

          <div className="flex justify-between items-center pt-3">
            <span className="text-muted-foreground font-medium">Evaluated Rule</span>
            <span className="text-foreground font-medium">
              {primarySignal?.rule_name ||
                (caseData as any).rule_description ||
                'Risk Exception Monitoring'}
            </span>
          </div>

          <div className="flex justify-between items-center pt-3">
            <span className="text-muted-foreground font-medium">Supplier</span>
            <span className="font-mono text-muted-foreground">
              {caseData.supplier_id || 'SUP-001'}
            </span>
          </div>
        </div>

        {hasPriorCases && (
          <div className="pt-3 border-t border-border space-y-2 text-xs">
            <p className="font-semibold text-foreground">Linked Prior Cases (Rule R-006)</p>
            {caseData.prior_cases!.map((pc: any) => (
              <div
                key={pc.case_id}
                className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-foreground">{pc.case_id}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {pc.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  Prior Root Cause: {pc.root_cause || 'Process error'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2">
          <Button
            size="sm"
            onClick={onViewSimilarCases}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            View Similar Cases
          </Button>
        </div>
      </Card>
    </div>
  )
}
