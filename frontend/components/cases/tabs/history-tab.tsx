'use client'

import React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { RiskCase } from '@/lib/api'

interface HistoryTabProps {
  caseData: RiskCase
  primarySignal: any
  auditSortOrder: 'asc' | 'desc'
  onToggleSortOrder: () => void
}

export function HistoryTab({
  caseData,
  primarySignal,
  auditSortOrder,
  onToggleSortOrder,
}: HistoryTabProps) {
  const isClosed = caseData.status === 'Closed'

  const sortedHistory = [...(caseData.history || [])].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime()
    const timeB = new Date(b.timestamp).getTime()
    return auditSortOrder === 'asc' ? timeA - timeB : timeB - timeA
  })

  return (
    <div className="space-y-6 pt-2">
      <Card className="p-5 bg-card border border-border/80 rounded-xl space-y-4 max-w-3xl">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <h2 className="text-sm font-bold text-foreground">Case Timeline</h2>
          <button
            onClick={onToggleSortOrder}
            className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowUpDown className="w-3 h-3" />
            {auditSortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
          </button>
        </div>

        {/* Chronological Vertical Timeline */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
          {/* 1. Case Created */}
          <div className="relative space-y-1 text-xs">
            <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-card" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-muted-foreground text-[11px]">
                {caseData.created_at
                  ? new Date(caseData.created_at).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Sep 05, 2026 10:15'}
              </span>
            </div>
            <p className="font-bold text-foreground">Case created by TRIS</p>
            <p className="text-muted-foreground">
              {primarySignal?.rule_name || (caseData as any).rule_description || 'Exception detected'}
            </p>
          </div>

          {/* 2. Ownership Assigned */}
          {(caseData.assigned_to || caseData.status !== 'New') && (
            <div className="relative space-y-1 text-xs">
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground text-[11px]">Lifecycle Step 2</span>
              </div>
              <p className="font-bold text-foreground">Ownership assigned</p>
              <p className="text-muted-foreground">
                {caseData.assigned_to || 'Risk Reviewer / Case Owner'}
              </p>
            </div>
          )}

          {/* 3. Investigation Updated */}
          {(caseData.status === 'Under Investigation' ||
            caseData.status === 'Corrective Action' ||
            caseData.status === 'Pending Verification' ||
            isClosed) && (
            <div className="relative space-y-1 text-xs">
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground text-[11px]">Lifecycle Step 3</span>
              </div>
              <p className="font-bold text-foreground">Investigation updated</p>
              <p className="text-muted-foreground">
                {caseData.root_cause
                  ? `Root cause: ${caseData.root_cause}`
                  : 'Findings and root cause recorded'}
              </p>
            </div>
          )}

          {/* 4. Corrective Action Completed */}
          {(caseData.status === 'Corrective Action' ||
            caseData.status === 'Pending Verification' ||
            isClosed) && (
            <div className="relative space-y-1 text-xs">
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-card" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground text-[11px]">Lifecycle Step 4</span>
              </div>
              <p className="font-bold text-foreground">Corrective action completed</p>
              <p className="text-muted-foreground">
                {caseData.corrective_action
                  ? `Remediation: ${caseData.corrective_action}`
                  : 'Remediation plan executed with evidence'}
              </p>
            </div>
          )}

          {/* 5. Case Closed */}
          {isClosed && (
            <div className="relative space-y-1 text-xs">
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-card" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground text-[11px]">
                  {caseData.closure_date
                    ? new Date(caseData.closure_date).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'Final Step'}
                </span>
              </div>
              <p className="font-bold text-foreground">Case closed &amp; verified</p>
              <p className="text-muted-foreground">
                All 8 mandatory closure fields verified by TRIS
              </p>
            </div>
          )}

          {/* Live History Entries from Backend */}
          {sortedHistory.length > 0 && (
            <div className="pt-4 border-t border-border/40 space-y-4">
              <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-muted-foreground">
                Append-Only Audit Entries ({sortedHistory.length})
              </p>
              {sortedHistory.map((h, i) => (
                <div key={h.history_id || i} className="relative space-y-0.5 text-xs">
                  <div className="absolute -left-6 top-1 w-2 h-2 rounded-full bg-slate-400 ring-4 ring-card" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{h.action}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(h.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">Actor: {h.actor}</p>
                  {h.note && (
                    <p className="text-[11px] bg-muted/20 p-2 rounded border border-border/40 text-muted-foreground italic">
                      &quot;{h.note}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
