'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, RuleConfig, DEFAULT_RULES_METADATA } from '@/lib/api'
import { Cpu, ShieldAlert } from 'lucide-react'

export function AnomalyPatterns() {
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.getRules()
      .then((data) => {
        if (mounted) {
          setRules(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <Card className="p-5 space-y-3 bg-card border-border">
        <div className="h-4 bg-muted/40 rounded w-1/2 animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-muted/20 rounded animate-pulse" />
        ))}
      </Card>
    )
  }

  // Fallback to DEFAULT_RULES_METADATA if API returned empty
  const displayRules = rules.length > 0 ? rules : Object.entries(DEFAULT_RULES_METADATA).map(([code, meta]) => ({
    rule_code: code,
    name: meta.name,
    description: meta.description,
    weight: meta.weight,
    rule_version: meta.version,
    is_active: true,
    threshold_params: {},
    updated_at: new Date().toISOString(),
  }))

  return (
    <Card className="p-5 bg-card border-border flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-primary" />
              Active Detection Rules
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Automated risk rules (R-001 to R-006)</p>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
            {displayRules.length} Rules Active
          </span>
        </div>

        <div className="space-y-2 mt-3">
          {displayRules.map((rule) => (
            <div
              key={rule.rule_code}
              className="p-2.5 rounded-lg bg-muted/10 border border-border/60 hover:border-border transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-primary shrink-0 px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20">
                    {rule.rule_code}
                  </span>
                  <p className="font-semibold text-xs text-foreground truncate">{rule.name}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                    +{rule.weight} pts
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground/70">
                    v{rule.rule_version}.0
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
