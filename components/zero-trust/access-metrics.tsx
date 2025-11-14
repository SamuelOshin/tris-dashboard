'use client'

import { Card } from '@/components/ui/card'
import { Lock, Eye, AlertTriangle, Zap } from 'lucide-react'

interface Metric {
  label: string
  value: string
  change: number
  icon: React.ReactNode
}

const metrics: Metric[] = [
  {
    label: 'Active Sessions',
    value: '1,247',
    change: -5,
    icon: <Lock className="w-5 h-5" />
  },
  {
    label: 'Access Violations',
    value: '12',
    change: 8,
    icon: <AlertTriangle className="w-5 h-5" />
  },
  {
    label: 'Monitored Users',
    value: '432',
    change: 3,
    icon: <Eye className="w-5 h-5" />
  },
  {
    label: 'System Health',
    value: '94%',
    change: -2,
    icon: <Zap className="w-5 h-5" />
  }
]

export function AccessMetrics() {
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
            <span className={`text-sm font-medium ${metric.change > 0 ? 'text-destructive' : 'text-success'}`}>
              {metric.change > 0 ? '+' : ''}{metric.change}%
            </span>
            <span className="text-xs text-muted-foreground">vs 24 hours</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
