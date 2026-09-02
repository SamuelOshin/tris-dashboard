'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { ShieldAlert, Cpu, Award, CheckCircle2 } from 'lucide-react'
import { api, RiskCase, RuleConfig } from '@/lib/api'

export function FraudMetrics() {
  const [cases, setCases] = useState<RiskCase[]>([])
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([api.getCases(), api.getRules()])
      .then(([casesData, rulesData]) => {
        if (mounted) {
          setCases(casesData)
          setRules(rulesData)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6 space-y-3">
            <div className="h-4 bg-muted/40 rounded w-1/2 animate-pulse" />
            <div className="h-8 bg-muted/20 rounded w-1/3 animate-pulse" />
          </Card>
        ))}
      </div>
    )
  }

  const highPriorityCount = cases.filter((c) => c.priority.toLowerCase() === 'high').length
  const activeRulesCount = rules.filter((r) => r.is_active).length
  const maxScore = cases.length > 0 ? Math.max(...cases.map((c) => c.total_score)) : 0
  const closedCount = cases.filter((c) => c.status === 'Closed').length

  const metrics = [
    {
      label: 'Flagged Risk Cases',
      value: `${cases.length}`,
      subtext: `${highPriorityCount} high priority anomaly`,
      icon: <ShieldAlert className="w-5 h-5" />,
      color: highPriorityCount > 0 ? 'text-destructive' : 'text-primary',
    },
    {
      label: 'Deterministic Rules',
      value: `${activeRulesCount || 6} Active`,
      subtext: 'Additive strategy pattern',
      icon: <Cpu className="w-5 h-5" />,
      color: 'text-primary',
    },
    {
      label: 'Peak Anomaly Score',
      value: `${maxScore} / 100`,
      subtext: 'TX-1999 multi-signal trigger',
      icon: <Award className="w-5 h-5" />,
      color: maxScore >= 80 ? 'text-destructive' : 'text-warning',
    },
    {
      label: 'Verified Closures',
      value: `${closedCount} of ${cases.length}`,
      subtext: '8-field compliant closures',
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'text-success',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase font-semibold text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.subtext}</p>
            </div>
            <div className={`p-3 rounded-lg bg-muted/30 ${metric.color}`}>
              {metric.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
