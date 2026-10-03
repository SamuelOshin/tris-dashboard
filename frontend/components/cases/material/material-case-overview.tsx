'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskBadge } from '@/components/manufacturing/risk-score/risk-badge'
import { formatAmount } from '@/components/manufacturing/exposure/exposure-guards'
import { formatDate } from '@/components/manufacturing/material-cost/material-cost-guards'
import { RiskCase } from '@/lib/api'
import { getPriorityBadgeStyle } from '../case-workflow-guards'
import { categoryLabel, snapshotOf } from './material-case-guards'

interface Props {
  caseData: RiskCase
  onAcceptCase: () => Promise<unknown>
  onViewTimeline: () => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  )
}

/** Overview of a material-cost case: the material, why it was opened, and the money at stake. */
export function MaterialCaseOverview({ caseData, onAcceptCase, onViewTimeline }: Props) {
  const snapshot = snapshotOf(caseData)
  const exposure = snapshot?.exposure
  const reasons = (snapshot?.factors ?? []).filter((f) => f.status === 'evaluated' && f.points > 0)
  const isClosed = caseData.status === 'Closed'

  return (
    <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-2">
      <Card className="space-y-3 rounded-xl border border-border/80 bg-card p-5">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h2 className="text-sm font-bold text-foreground">Case Details</h2>
          <span className="font-mono text-[11px] text-muted-foreground">ID: {caseData.case_id}</span>
        </div>
        <div className="divide-y divide-border/40 text-xs">
          <Row label="Type">{categoryLabel(caseData)}</Row>
          <Row label="Material">
            <span className="font-mono">{caseData.material_id}</span>
          </Row>
          <Row label="Priority">
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${getPriorityBadgeStyle(caseData.priority)}`}>
              {caseData.priority}
            </span>
          </Row>
          <Row label="Status">{caseData.status}</Row>
          <Row label="Owner">
            {caseData.assigned_to || (
              <button onClick={onAcceptCase} className="font-semibold text-primary hover:underline">
                Assign to Me
              </button>
            )}
          </Row>
          <Row label="Main supplier">{caseData.supplier_id ?? 'Not recorded'}</Row>
          <Row label="Opened">{formatDate(caseData.created_at)}</Row>
          {caseData.forecast_horizon != null && (
            <Row label="Forecast horizon">{caseData.forecast_horizon} days</Row>
          )}
          {caseData.projected_exposure_amount != null && (
            <Row label="Projected exposure">
              {formatAmount(caseData.projected_exposure_amount, exposure?.currency ?? snapshot?.currency)}
            </Row>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-3 rounded-xl border border-border/80 bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Why This Case Was Opened</h2>
            {snapshot && (
              <RiskBadge
                score={{
                  score_id: snapshot.score_id,
                  material_id: caseData.material_id ?? '',
                  as_of: snapshot.as_of,
                  currency: snapshot.currency,
                  score: snapshot.score,
                  level: snapshot.level as 'High' | 'Critical',
                  data_coverage_pct: snapshot.data_coverage_pct,
                  summary: snapshot.summary,
                  method_version: snapshot.method_version,
                  weight_version: snapshot.weight_version,
                  forecast_run_id: snapshot.forecast?.run_id ?? null,
                  created_by: '',
                  created_at: caseData.created_at,
                }}
              />
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {snapshot?.summary ?? 'This case was opened from a material risk score.'}
          </p>
          <ul className="space-y-2 border-t border-border/50 pt-3">
            {reasons.map((f) => (
              <li key={f.code} className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{f.name}</span>
                  <span className="tabular-nums text-muted-foreground">+{f.points.toFixed(1)} points</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{f.explanation}</p>
              </li>
            ))}
          </ul>
          {snapshot && snapshot.linked_scores.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {snapshot.linked_scores.length} later score(s) linked to this case.
            </p>
          )}
        </Card>

        {exposure && (
          <Card className="space-y-2 rounded-xl border border-border/80 bg-card p-5 text-xs">
            <h3 className="text-xs font-bold text-foreground">Cost Exposure When Opened</h3>
            <p className="text-muted-foreground">
              Spend at latest prices {formatAmount(exposure.baseline_spend, exposure.currency)}, at forecast prices{' '}
              {formatAmount(exposure.forecast_spend, exposure.currency)} over the next {exposure.horizon_days} days.
            </p>
          </Card>
        )}

        {isClosed && (
          <Card className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-xs">
            <h3 className="text-sm font-bold text-foreground">Case Closed &amp; Verified</h3>
            <p className="text-muted-foreground">Root cause: {caseData.root_cause}</p>
            <p className="text-muted-foreground">Corrective action: {caseData.corrective_action}</p>
            <Button size="sm" onClick={onViewTimeline} className="w-full text-xs">
              View Timeline
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
