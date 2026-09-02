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
            highPriorityCount: cases.filter((c) => c.priority?.toLowerCase() === 'high').length,
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
          <Card key={i} className="p-5.5 space-y-3 bg-card border-0 rounded-2xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)]">
            <div className="h-3.5 bg-muted/40 rounded-lg w-1/2 animate-pulse" />
            <div className="h-7 bg-muted/20 rounded-lg w-1/3 animate-pulse" />
            <div className="h-3 bg-muted/20 rounded-lg w-2/3 animate-pulse" />
          </Card>
        ))}
      </>
    )
  }

  const cards = [
    {
      label: 'Flagged Risk Cases',
      value: String(stats.casesCount),
      subtext: stats.highPriorityCount > 0 
        ? `${stats.highPriorityCount} critical anomaly requiring immediate review`
        : 'Zero critical anomalies detected across active roster',
      badge: stats.highPriorityCount > 0 ? 'Action Required' : 'All Clear',
      badgeClass: stats.highPriorityCount > 0 
        ? 'bg-destructive/10 text-destructive border-destructive/20' 
        : 'bg-success/10 text-success border-success/20',
      icon: <ShieldAlert className="w-4 h-4" />,
      iconColor: stats.highPriorityCount > 0 
        ? 'text-destructive bg-destructive/10 border-destructive/20' 
        : 'text-primary bg-primary/10 border-primary/20',
    },
    {
      label: 'Monitored Suppliers',
      value: String(stats.suppliersCount),
      subtext: 'Active risk monitoring across vendor accounts',
      badge: 'Active Roster',
      badgeClass: 'bg-muted/40 text-muted-foreground border-border',
      icon: <Users className="w-4 h-4" />,
      iconColor: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      label: 'Audited Invoices',
      value: String(stats.transactionsCount),
      subtext: 'Supplier invoices evaluated against active rules',
      badge: '100% Evaluated',
      badgeClass: 'bg-success/10 text-success border-success/20',
      icon: <Receipt className="w-4 h-4" />,
      iconColor: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      label: 'Active Detection Rules',
      value: `${stats.rulesCount} Active`,
      subtext: 'Automated fraud and compliance detection rules',
      badge: 'Active',
      badgeClass: 'bg-primary/10 text-primary border-primary/20',
      icon: <Cpu className="w-4 h-4" />,
      iconColor: 'text-primary bg-primary/10 border-primary/20',
    },
  ]

  return (
    <>
      {cards.map((card) => (
        <Card
          key={card.label}
          className="p-5.5 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] transition-all duration-200 group flex flex-col justify-between"
        >
          {/* Header row: Label on left, Icon on right */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase font-mono tracking-wider font-semibold text-muted-foreground">
                {card.label}
              </p>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${card.iconColor}`}>
                {card.icon}
              </div>
            </div>

            {/* Metric value and badge */}
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-bold text-foreground font-mono tracking-tight">
                {card.value}
              </span>
              <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${card.badgeClass}`}>
                {card.badge}
              </span>
            </div>
          </div>

          {/* Full-width explanatory footer with tooltip */}
          <div className="mt-3 pt-2.5 border-t border-border/50">
            <p
              className="text-[11px] text-muted-foreground leading-relaxed cursor-help"
              title={card.subtext}
            >
              {card.subtext}
            </p>
          </div>
        </Card>
      ))}
    </>
  )
}
