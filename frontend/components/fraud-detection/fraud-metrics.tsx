'use client'

import { Card } from '@/components/ui/card'
import { TrendingUp, AlertTriangle, DollarSign, Eye } from 'lucide-react'

interface Metric {
  label: string
  value: string
  change: number
  trend: 'up' | 'down'
  icon: React.ReactNode
}

const metrics: Metric[] = [
  {
    label: 'Fraud Risk Score',
    value: '34%',
    change: 8,
    trend: 'up',
    icon: <AlertTriangle className="w-5 h-5" />
  },
  {
    label: 'Flagged Transactions',
    value: '47',
    change: -12,
    trend: 'down',
    icon: <TrendingUp className="w-5 h-5" />
  },
  {
    label: 'Anomalous Amount',
    value: '$847K',
    change: 23,
    trend: 'up',
    icon: <DollarSign className="w-5 h-5" />
  },
  {
    label: 'Detection Accuracy',
    value: '96.8%',
    change: 2,
    trend: 'up',
    icon: <Eye className="w-5 h-5" />
  }
]

export function FraudMetrics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              {metric.icon}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1">
            <span className={`text-sm font-medium ${metric.trend === 'up' ? 'text-destructive' : 'text-success'}`}>
              {metric.trend === 'up' ? '+' : '-'}{metric.change}%
            </span>
            <span className="text-xs text-muted-foreground">vs last week</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
