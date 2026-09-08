'use client'

import React, { useState } from 'react'
import { Sliders, ShieldCheck, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ErrorCard } from '@/components/ui/error-card'
import { RuleConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

interface DetectionRulesTabProps {
  rules: RuleConfig[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onUpdateWeight: (ruleCode: string, newWeight: number) => Promise<void>
  onToggleActive: (ruleCode: string, currentActive: boolean) => Promise<void>
  updatingRuleCode: string | null
}

function formatThresholdParam(key: string, value: any): string {
  const label = key.replace(/_/g, ' ')
  if (typeof value === 'boolean') return `${label}: ${value ? 'Yes' : 'No'}`
  if (typeof value === 'number') {
    if (key.includes('ratio') || key.includes('multiplier')) return `${label}: ${value}x`
    if (key.includes('days') || key.includes('window')) return `${label}: ${value}d`
    return `${label}: ${value}`
  }
  return `${label}: ${String(value)}`
}

export function DetectionRulesTab({
  rules,
  loading,
  error,
  onRetry,
  onUpdateWeight,
  onToggleActive,
  updatingRuleCode,
}: DetectionRulesTabProps) {
  const { hasPermission } = useAuth()
  const isPrivileged = hasPermission(['admin', 'compliance'])
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({})

  const getWeightValue = (r: RuleConfig) => {
    return localWeights[r.rule_code] !== undefined ? localWeights[r.rule_code] : r.weight
  }

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-xs bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                Detection Rules Engine
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Active deterministic anomaly rules, threshold parameters, and additive scoring weights.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 text-[10px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-Time Evaluation Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          {error ? (
            <ErrorCard title="Failed to Load Detection Rules" message={error} onRetry={onRetry} />
          ) : loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {rules.map((r) => {
                const isUpdating = updatingRuleCode === r.rule_code
                const thresholdEntries = Object.entries(r.threshold_params || {})

                return (
                  <div
                    key={r.rule_code}
                    className="p-3.5 bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors hover:bg-muted/15"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-primary text-xs">{r.rule_code}</span>
                        <span className="font-semibold text-foreground text-xs">{r.name}</span>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          v{r.rule_version}
                        </Badge>
                        {!r.is_active && (
                          <Badge variant="secondary" className="text-[9px] text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </div>

                      <p className="text-muted-foreground text-[11px] leading-snug">{r.description}</p>

                      {thresholdEntries.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {thresholdEntries.map(([k, v]) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded bg-muted/60 border border-border/70 text-[10px] font-mono text-muted-foreground capitalize"
                            >
                              {formatThresholdParam(k, v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium">Weight:</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={getWeightValue(r)}
                          disabled={!isPrivileged || isUpdating}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            setLocalWeights((prev) => ({ ...prev, [r.rule_code]: val }))
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0
                            if (val !== r.weight) {
                              void onUpdateWeight(r.rule_code, val)
                            }
                          }}
                          className="w-16 h-8 text-xs text-center font-mono font-bold"
                          title={isPrivileged ? 'Adjust scoring weight' : 'Admin or Compliance role required to edit weight'}
                        />
                        <span className="text-[10px] text-muted-foreground">pts</span>
                      </div>

                      <Switch
                        checked={r.is_active}
                        disabled={!isPrivileged || isUpdating}
                        onCheckedChange={() => onToggleActive(r.rule_code, r.is_active)}
                        title={isPrivileged ? 'Toggle rule active state' : 'Admin or Compliance role required'}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!isPrivileged && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-2 text-muted-foreground text-xs">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>
                Read-only view: Rule weights and active statuses can only be modified by accounts with <strong>Compliance Lead</strong> or <strong>System Administrator</strong> privileges.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scoring Architecture Explanation */}
      <Card className="border-border shadow-xs bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Deterministic Additive Scoring Model
          </CardTitle>
          <CardDescription className="text-xs">
            How triggered rule signals calculate the composite risk score for each transaction exception.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            TRIS evaluates each accounts payable invoice against active detection rules in parallel.
            When a condition triggers, its configured weight (points) is added to the case composite score.
            The total score determines mandatory SLA response times and reviewer priority:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 space-y-1">
              <span className="text-xs font-bold text-destructive font-mono">Score &gt;= 80 pts</span>
              <p className="font-semibold text-foreground">High Priority</p>
              <p className="text-[11px] text-muted-foreground">Immediate escalation. Formal investigation and dual verification mandatory.</p>
            </div>
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 space-y-1">
              <span className="text-xs font-bold text-warning font-mono">Score 50 – 79 pts</span>
              <p className="font-semibold text-foreground">Medium Priority</p>
              <p className="text-[11px] text-muted-foreground">Standard review queue. Prerequisite corrective actions required.</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
              <span className="text-xs font-bold text-foreground font-mono">Score &lt; 50 pts</span>
              <p className="font-semibold text-foreground">Low Priority</p>
              <p className="text-[11px] text-muted-foreground">Routine audit monitoring with automated lookback surveillance.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
