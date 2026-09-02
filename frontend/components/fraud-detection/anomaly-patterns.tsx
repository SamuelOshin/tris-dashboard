'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, RuleConfig } from '@/lib/api'
import { Cpu } from 'lucide-react'

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
      <Card className="p-6 space-y-3">
        <div className="h-5 bg-muted/40 rounded w-1/2 animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted/20 rounded animate-pulse" />
        ))}
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Active Heuristics Engine</h2>
          <p className="text-xs text-muted-foreground">Deterministic rule triggers (R-001 – R-006)</p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
          {rules.length} Rules
        </Badge>
      </div>

      <div className="space-y-2.5">
        {rules.map((rule) => (
          <div key={rule.rule_code} className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{rule.rule_code}</span>
                  <p className="font-medium text-xs text-foreground truncate">{rule.name}</p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{rule.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <Badge variant="outline" className="text-[10px] font-mono">
                  +{rule.weight} pts
                </Badge>
                <div className="text-[10px] text-muted-foreground mt-0.5">v{rule.rule_version}.0</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
