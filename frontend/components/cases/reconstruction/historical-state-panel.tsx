'use client'

import React from 'react'
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  Building2,
  Receipt,
  FileCheck2,
  AlertTriangle,
  Lock,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReconstructionResult, formatCurrency } from '@/lib/api'

interface HistoricalStatePanelProps {
  reconstruction: ReconstructionResult
}

export function HistoricalStatePanel({ reconstruction }: HistoricalStatePanelProps) {
  const { outcome, explanation, event_timestamp, approval_state, supplier_state, transaction_state, access_state } =
    reconstruction

  const getOutcomeBadge = () => {
    switch (outcome) {
      case 'PASS':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 gap-1.5 px-2.5 py-1 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>HISTORICAL CONTROL PASSED</span>
          </Badge>
        )
      case 'FAIL':
        return (
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 gap-1.5 px-2.5 py-1 text-xs font-semibold">
            <XCircle className="w-3.5 h-3.5" />
            <span>HISTORICAL CONTROL FAILED</span>
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20 gap-1.5 px-2.5 py-1 text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>OUTCOME UNKNOWN (MISSING EVIDENCE)</span>
          </Badge>
        )
    }
  }

  const effectiveApprovals = approval_state?.effective_approvals || []
  const excludedApprovals = approval_state?.excluded_late_approvals || []

  return (
    <Card className="p-5 bg-card border-border/80 space-y-5 rounded-xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {getOutcomeBadge()}
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-muted-foreground" />
              Event Anchor: {new Date(event_timestamp).toUTCString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cross-system state reconstructed as of transaction event time. Post-event records strictly excluded.
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
            Evidence: {reconstruction.evidence_completeness.overall}
          </Badge>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-foreground leading-relaxed">
        <span className="font-semibold text-foreground mr-1.5">Determination Rationale:</span>
        {explanation}
      </div>

      {/* Grid of Domain States */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Transaction Operational State */}
        <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Receipt className="w-3.5 h-3.5 text-blue-500" />
            <span>Operational Transaction Fact</span>
          </div>
          {transaction_state ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Amount</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatCurrency(transaction_state.amount)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Invoice Date</span>
                <span className="font-mono text-foreground">{transaction_state.invoice_date || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Approval Required</span>
                <span className="text-foreground">{transaction_state.approval_required ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Status at Event</span>
                <span className="font-semibold text-foreground">{transaction_state.approval_status_at_event}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Transaction evidence missing at event time.</p>
          )}
        </div>

        {/* Supplier Master Data State */}
        <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Supplier State as-of Event</span>
          </div>
          {supplier_state ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Vendor Name</span>
                <span className="font-semibold text-foreground truncate block">{supplier_state.name || supplier_state.supplier_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Risk Tier</span>
                <span className="text-foreground">{supplier_state.risk_tier || 'Standard'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Bank Change Date</span>
                <span className="font-mono text-foreground">{supplier_state.bank_change_date || 'None'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Bank Changed &lt; 7 Days</span>
                <Badge
                  variant={supplier_state.bank_changed_within_7_days ? 'destructive' : 'outline'}
                  className="text-[10px] px-1.5 py-0 font-mono"
                >
                  {supplier_state.bank_changed_within_7_days ? 'YES (Trigger)' : 'No'}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Supplier records unavailable at event timestamp.</p>
          )}
        </div>
      </div>

      {/* Approval Timeline Analysis (Temporal Exclusion Guard) */}
      <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileCheck2 className="w-4 h-4 text-emerald-500" />
            <span>Approval Chain Analysis (Temporal Guard)</span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            Highest Pre-Event Level: {approval_state?.highest_effective_level || 'None'}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          {/* Effective Approvals */}
          {effectiveApprovals.length > 0 ? (
            effectiveApprovals.map((app) => (
              <div
                key={app.approval_id}
                className="flex items-center justify-between p-2 rounded border border-emerald-500/20 bg-emerald-500/5 text-foreground"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-mono font-semibold">{app.approval_id}</span>
                  <span className="text-muted-foreground">({app.required_level || 'Level 1'})</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {app.approval_date ? new Date(app.approval_date).toUTCString() : ''}
                  </span>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 text-[10px]">
                  Effective Pre-Event
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground italic text-xs p-2">
              No effective approvals recorded prior to this transaction.
            </div>
          )}

          {/* Excluded Late Approvals (Hindsight Bias Prevention) */}
          {excludedApprovals.map((app) => (
            <div
              key={app.approval_id}
              className="flex items-center justify-between p-2 rounded border border-rose-500/20 bg-rose-500/5 text-foreground"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span className="font-mono font-semibold">{app.approval_id}</span>
                <span className="text-muted-foreground">({app.required_level || 'Level 2'})</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {app.approval_date ? new Date(app.approval_date).toUTCString() : ''}
                </span>
              </div>
              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[10px]">
                Excluded: Post-Event ({app.exclusion_reason || 'Recorded after transaction'})
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
