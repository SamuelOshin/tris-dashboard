'use client'

import { Card } from '@/components/ui/card'
import { Users, AlertTriangle, TrendingDown, Zap } from 'lucide-react'

interface Metric {
  label: string
  value: string
  change: number
  trend: 'up' | 'down'
  icon: React.ReactNode
}

const metrics: Metric[] = [
  {
    label: 'Active Suppliers',
    value: '287',
    change: 5,
    trend: 'up',
    icon: <Users className="w-5 h-5" />
  },
  {
    label: 'At-Risk Vendors',
    value: '23',
    change: -8,
    trend: 'down',
    icon: <AlertTriangle className="w-5 h-5" />
  },
  {
    label: 'Supplier Concentration',
    value: '32%',
    change: -3,
    trend: 'down',
    icon: <TrendingDown className="w-5 h-5" />
  },
  {
    label: 'Supply Chain Health',
    value: '78/100',
    change: 6,
    trend: 'up',
    icon: <Zap className="w-5 h-5" />
  }
]

export function SupplierMetrics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/10 text-accent">
              {metric.icon}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1">
            <span className={`text-sm font-medium ${metric.trend === 'up' && metric.change > 0 ? 'text-destructive' : 'text-success'}`}>
              {metric.trend === 'up' ? '+' : '-'}{metric.change}%
            </span>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
