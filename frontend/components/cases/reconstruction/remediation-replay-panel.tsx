'use client'

import React from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Sliders,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  RemediationReplayResult,
  ProposedControl,
  formatCurrency,
} from '@/lib/api'

interface RemediationReplayPanelProps {
  replay: RemediationReplayResult | null
  proposedControls: ProposedControl[]
  selectedControlId: string
  onSelectControlId: (id: string) => void
  onRunReplay: (controlId?: string) => void
  isReplayLoading: boolean
}

export function RemediationReplayPanel({
  replay,
  proposedControls,
  selectedControlId,
  onSelectControlId,
  onRunReplay,
  isReplayLoading,
}: RemediationReplayPanelProps) {
  const getDeterminationBadge = (determination?: string) => {
    switch (determination) {
      case 'BLOCK/PREVENT':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
            <Ban className="w-3.5 h-3.5" />
            <span>BLOCK / PREVENT</span>
          </Badge>
        )
      case 'ESCALATE/HOLD':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>ESCALATE / HOLD</span>
          </Badge>
        )
      case 'ALLOW':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>ALLOW PAYMENT</span>
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>NOT DETERMINABLE</span>
          </Badge>
        )
    }
  }

  const activeControl = proposedControls.find((c) => c.control_id === selectedControlId)

  return (
    <Card className="p-5 bg-card border-border/80 space-y-5 rounded-xl">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Remediation Replay Simulation</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Evaluate proposed policy changes against reconstructed historical state without modifying live data.
          </p>
        </div>

        {/* Action Trigger */}
        <Button
          size="sm"
          onClick={() => onRunReplay(selectedControlId)}
          disabled={isReplayLoading}
          className="gap-2 text-xs font-semibold self-start sm:self-center"
        >
          {isReplayLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Replay Simulation</span>
            </>
          )}
        </Button>
      </div>

      {/* Side-by-Side Comparison: Original vs Proposed Control */}
      {replay ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Original Finding */}
            <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Original Historical Control
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant={replay.original_outcome === 'PASS' ? 'outline' : 'destructive'}
                  className="px-2.5 py-1 text-xs font-bold gap-1"
                >
                  {replay.original_outcome === 'PASS' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-rose-500" />
                  )}
                  <span>ORIGINAL: {replay.original_outcome}</span>
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Control decision rendered at historical event time based on rules active during the surveillance period.
              </p>
            </div>

            {/* Right: Proposed Control Finding */}
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
                Replayed Corrective Policy
              </span>
              <div>{getDeterminationBadge(replay.replay_determination)}</div>
              <p className="text-xs text-foreground font-medium leading-relaxed">
                {replay.explanation}
              </p>
            </div>
          </div>

          {/* Driving Facts Table */}
          {replay.driving_facts && (
            <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Simulation Driving Facts</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded bg-background border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">Invoice Amount</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(replay.driving_facts.amount)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Threshold: {formatCurrency(replay.driving_facts.amount_threshold)}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">Bank Change Delta</span>
                  <span className="font-mono font-bold text-foreground">
                    {replay.driving_facts.days_since_bank_change != null
                      ? `${replay.driving_facts.days_since_bank_change} days`
                      : 'N/A'}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Window: &lt; {replay.driving_facts.window_days} days
                  </span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">Effective Pre-Event Level</span>
                  <span className="font-mono font-bold text-foreground">
                    {replay.driving_facts.effective_highest_approval_level || 'None'}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Required: {replay.driving_facts.required_approval_level}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">Independent Verification</span>
                  <span className="font-semibold text-foreground">
                    {replay.driving_facts.independent_verification_present ? 'Satisfied' : 'Missing'}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Late Excluded: {replay.driving_facts.excluded_late_approvals_count}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center border border-dashed border-border rounded-xl space-y-2">
          <p className="text-xs text-muted-foreground">
            No simulation run recorded yet for this transaction. Click &quot;Run Replay Simulation&quot; to test the proposed control.
          </p>
        </div>
      )}
    </Card>
  )
}
