'use client'

import { Card } from '@/components/ui/card'
import { CheckCircle, AlertCircle, FileText, Clock } from 'lucide-react'

interface Metric {
  label: string
  value: string
  change: number
  icon: React.ReactNode
  color: string
}

const metrics: Metric[] = [
  {
    label: 'Compliance Score',
    value: '92%',
    change: 3,
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-success'
  },
  {
    label: 'Open Findings',
    value: '4',
    change: -1,
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-warning'
  },
  {
    label: 'Audit Records',
    value: '12.4K',
    change: 15,
    icon: <FileText className="w-5 h-5" />,
    color: 'text-accent'
  },
  {
    label: 'Last Audit',
    value: '2 days ago',
    change: 0,
    icon: <Clock className="w-5 h-5" />,
    color: 'text-primary'
  }
]

export function ComplianceMetrics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-primary/10 ${metric.color}`}>
              {metric.icon}
            </div>
          </div>
          {metric.change !== 0 && (
            <div className="mt-4 flex items-center gap-1">
              <span className={`text-sm font-medium ${metric.change > 0 ? 'text-destructive' : 'text-success'}`}>
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </span>
              <span className="text-xs text-muted-foreground">vs last audit</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
