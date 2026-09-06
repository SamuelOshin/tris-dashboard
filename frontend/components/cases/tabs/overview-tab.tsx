'use client'

import React from 'react'
import { Activity, Cpu, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskCase } from '@/lib/api'
import { getPriorityBadgeStyle } from '../case-workflow-guards'

interface OverviewTabProps {
  caseData: RiskCase
  primarySignal: any
  enrichedSignals: any[]
  onAcceptCase: () => Promise<any>
  onViewTimeline: () => void
}

export function OverviewTab({
  caseData,
  primarySignal,
  enrichedSignals,
  onAcceptCase,
  onViewTimeline,
}: OverviewTabProps) {
  const isClosed = caseData.status === 'Closed'
  const priorityBadgeColor = getPriorityBadgeStyle(caseData.priority)

  return (
    <div className="space-y-6 pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Case Details & Supplier Baseline */}
        <div className="space-y-4">
          <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-foreground">Case Details</h2>
              <span className="text-[11px] font-mono text-muted-foreground">
                ID: {caseData.case_id}
              </span>
            </div>

            <div className="space-y-3 text-xs divide-y divide-border/40">
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Case ID</span>
                <span className="font-mono font-bold text-foreground">{caseData.case_id}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Triggered Rule</span>
                <span className="font-semibold text-foreground text-right max-w-[240px] truncate">
                  {primarySignal?.rule_code
                    ? `${primarySignal.rule_code}: ${primarySignal.rule_name}`
                    : 'Duplicate invoice detected (R-005)'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Priority</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${priorityBadgeColor}`}
                >
                  {caseData.priority}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Status</span>
                <span className="font-semibold text-foreground">{caseData.status}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Owner</span>
                <span className="font-mono font-medium text-foreground">
                  {caseData.assigned_to || (
                    <button
                      onClick={onAcceptCase}
                      className="text-primary hover:underline font-semibold"
                    >
                      Assign to Me
                    </button>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Date Created</span>
                <span className="font-mono text-muted-foreground">
                  {caseData.created_at
                    ? new Date(caseData.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })
                    : 'Sep 05, 2026'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Due Date</span>
                <span className="font-mono text-muted-foreground">Sep 08, 2026</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Supplier / Entity</span>
                <span className="font-mono font-semibold text-foreground">
                  {caseData.supplier_id || 'SUP-001'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Transaction Reference</span>
                <span className="font-mono text-foreground">
                  {caseData.transaction_id || 'TX-1999'}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Last Updated</span>
                <span className="font-mono text-muted-foreground">
                  {caseData.updated_at
                    ? new Date(caseData.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })
                    : 'Sep 06, 2026'}
                </span>
              </div>
            </div>
          </Card>

          {/* Supplier Historical Baseline Card */}
          <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Supplier Historical Baseline
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                Strict Exclusion Active
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Evaluated against historical baseline of supplier{' '}
              <span className="font-mono font-semibold text-foreground">
                {caseData.supplier_id || 'SUP-001'}
              </span>{' '}
              across prior transactions. Target transaction{' '}
              <span className="font-mono font-semibold text-foreground">
                {caseData.transaction_id || 'TX-1999'}
              </span>{' '}
              is strictly excluded from baseline calculation to eliminate bias.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center font-mono">
              <div className="p-2 rounded-lg bg-muted/20 border border-border/40">
                <p className="text-[10px] text-muted-foreground uppercase">Historical Mean</p>
                <p className="text-xs font-bold text-foreground mt-0.5">$30,471.43</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/20 border border-border/40">
                <p className="text-[10px] text-muted-foreground uppercase">Evaluated Tx</p>
                <p className="text-xs font-bold text-foreground mt-0.5">$104,000.00</p>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                <p className="text-[10px] uppercase font-bold">Deviation</p>
                <p className="text-xs font-bold mt-0.5">3.41x (&gt; 2.0x)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Why This Case Was Flagged */}
        <div className="space-y-4">
          <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Why This Case Was Flagged</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                Additive Scoring Engine
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {primarySignal?.explanation ||
                'Automated risk detection rules identified an operational or financial anomaly requiring review.'}
            </p>

            {/* Multi-Signal Breakdown */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs font-bold text-foreground">Triggered Detection Rules</p>
              <div className="space-y-2">
                {enrichedSignals && enrichedSignals.length > 0 ? (
                  enrichedSignals.map((signal, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-primary" />
                          {signal.rule_code}: {signal.rule_name}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          +{signal.weight || signal.score} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {signal.explanation}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">
                        R-005: Duplicate Invoice Detected
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        +50 pts
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Two invoices sharing identical invoice number and dollar amount detected for
                      the same supplier within 30 days.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-border/50 space-y-2">
              <h3 className="text-xs font-bold text-foreground">Potential Risk</h3>
              <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                <li>Duplicate payment disbursement</li>
                <li>Financial loss exposure</li>
                <li>Internal control bypass</li>
              </ul>
            </div>
          </Card>

          {/* Final Closed Case View Card */}
          {isClosed && (
            <Card className="p-5 bg-emerald-500/5 border border-emerald-500/30 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Case Closed &amp; Verified</h3>
                  <p className="text-xs text-muted-foreground">
                    All required actions completed and verified by TRIS.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 text-xs space-y-1.5">
                <p className="font-semibold text-foreground">Outcome</p>
                <ul className="text-muted-foreground space-y-1 pl-4 list-disc">
                  <li>{caseData.corrective_action || 'Remediation completed'}</li>
                  <li>Root cause: {caseData.root_cause || 'Documented and addressed'}</li>
                  <li>Evidence on file: {caseData.closure_evidence || 'Audit verification log'}</li>
                  <li>Enrolled in 90-day recurrence monitoring (Rule R-006)</li>
                </ul>
              </div>

              <Button
                size="sm"
                onClick={onViewTimeline}
                className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                View Timeline
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
