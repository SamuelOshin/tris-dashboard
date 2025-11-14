'use client'

import { Card } from '@/components/ui/card'
import { AlertCircle, TrendingUp, DollarSign, Users } from 'lucide-react'

interface Metric {
  label: string
  value: string | number
  change: number
  icon: React.ReactNode
  status: 'critical' | 'warning' | 'normal'
}

const metrics: Metric[] = [
  {
    label: 'Critical Alerts',
    value: '7',
    change: -12,
    icon: <AlertCircle className="w-5 h-5" />,
    status: 'critical'
  },
  {
    label: 'Fraud Risk Score',
    value: '34%',
    change: 8,
    icon: <TrendingUp className="w-5 h-5" />,
    status: 'warning'
  },
  {
    label: 'Transaction Volume',
    value: '$2.4M',
    change: 23,
    icon: <DollarSign className="w-5 h-5" />,
    status: 'normal'
  },
  {
    label: 'At-Risk Suppliers',
    value: '12',
    change: -5,
    icon: <Users className="w-5 h-5" />,
    status: 'warning'
  },
]

export function RiskMetrics() {
  return (
    <>
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${
              metric.status === 'critical' ? 'bg-destructive/10 text-destructive' :
              metric.status === 'warning' ? 'bg-warning/10 text-warning' :
              'bg-success/10 text-success'
            }`}>
              {metric.icon}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1">
            <span className={`text-sm font-medium ${metric.change >= 0 ? 'text-destructive' : 'text-success'}`}>
              {metric.change >= 0 ? '+' : ''}{metric.change}%
            </span>
            <span className="text-xs text-muted-foreground">vs last period</span>
          </div>
        </Card>
      ))}
    </>
  )
}
