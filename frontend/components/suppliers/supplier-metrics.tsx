'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Users, AlertTriangle, Landmark, ShieldCheck } from 'lucide-react'
import { api, Supplier } from '@/lib/api'

export function SupplierMetrics() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api
      .getSuppliers()
      .then((data) => {
        if (mounted) setSuppliers(data)
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

  const total = suppliers.length
  const highRisk = suppliers.filter((s) => s.risk_tier?.toLowerCase() === 'high').length
  const bankChanges = suppliers.filter((s) => Boolean(s.bank_change_date)).length
  const activeCount = suppliers.filter((s) => s.status?.toLowerCase() === 'active').length

  const metrics = [
    {
      label: 'Monitored Suppliers',
      value: String(total),
      subtext: 'Persisted in database',
      icon: <Users className="w-5 h-5" />,
      color: 'text-primary',
    },
    {
      label: 'High Risk Tier',
      value: String(highRisk),
      subtext: 'Elevated audit scrutiny',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: highRisk > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      label: 'Recent Bank Changes',
      value: String(bankChanges),
      subtext: 'R-002 signal monitoring',
      icon: <Landmark className="w-5 h-5" />,
      color: bankChanges > 0 ? 'text-warning' : 'text-muted-foreground',
    },
    {
      label: 'Active Verification Status',
      value: `${activeCount}/${total}`,
      subtext: 'Qualified vendors',
      icon: <ShieldCheck className="w-5 h-5" />,
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
