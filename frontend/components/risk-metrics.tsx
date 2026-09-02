'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { ShieldAlert, Users, Receipt, Cpu } from 'lucide-react'
import { api } from '@/lib/api'

export function RiskMetrics() {
  const [stats, setStats] = useState<{
    casesCount: number
    highPriorityCount: number
    suppliersCount: number
    transactionsCount: number
    rulesCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.getCases().catch(() => []),
      api.getSuppliers().catch(() => []),
      api.getTransactions().catch(() => []),
      api.getRules().catch(() => []),
    ])
      .then(([cases, suppliers, transactions, rules]) => {
        if (mounted) {
          setStats({
            casesCount: cases.length,
            highPriorityCount: cases.filter((c) => c.priority.toLowerCase() === 'high').length,
            suppliersCount: suppliers.length,
            transactionsCount: transactions.length,
            rulesCount: rules.length || 6,
          })
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  if (loading || !stats) {
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6 space-y-3">
            <div className="h-4 bg-muted/40 rounded w-1/2 animate-pulse" />
            <div className="h-8 bg-muted/20 rounded w-1/3 animate-pulse" />
          </Card>
        ))}
      </>
    )
  }

  const cards = [
    {
      label: 'Flagged Risk Cases',
      value: String(stats.casesCount),
      subtext: `${stats.highPriorityCount} requiring verification`,
      icon: <ShieldAlert className="w-5 h-5" />,
      color: stats.highPriorityCount > 0 ? 'text-destructive bg-destructive/10' : 'text-primary bg-primary/10',
    },
    {
      label: 'Monitored Suppliers',
      value: String(stats.suppliersCount),
      subtext: 'Persisted in database',
      icon: <Users className="w-5 h-5" />,
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'Audited Invoices',
      value: String(stats.transactionsCount),
      subtext: 'Ingested ledger volume',
      icon: <Receipt className="w-5 h-5" />,
      color: 'text-info bg-info/10',
    },
    {
      label: 'Strategy Rules',
      value: `${stats.rulesCount} Active`,
      subtext: 'Additive scoring heuristics',
      icon: <Cpu className="w-5 h-5" />,
      color: 'text-success bg-success/10',
    },
  ]

  return (
    <>
      {cards.map((card) => (
        <Card key={card.label} className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase font-semibold text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold text-foreground font-mono">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.subtext}</p>
            </div>
            <div className={`p-3 rounded-lg ${card.color}`}>
              {card.icon}
            </div>
          </div>
        </Card>
      ))}
    </>
  )
}
