'use client'

import { Card } from '@/components/ui/card'
import { AlertCircle, Clock, User } from 'lucide-react'

interface Alert {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: string
  type: string
}

const alerts: Alert[] = [
  {
    id: '1',
    title: 'Unusual Transaction Pattern',
    description: 'Invoice amount 350% above average',
    severity: 'critical',
    timestamp: '5 min ago',
    type: 'Fraud'
  },
  {
    id: '2',
    title: 'Supplier Compliance Risk',
    description: 'Vendor rating dropped to C-level',
    severity: 'warning',
    timestamp: '12 min ago',
    type: 'Supply Chain'
  },
  {
    id: '3',
    title: 'Access Pattern Anomaly',
    description: 'User accessed restricted data outside hours',
    severity: 'warning',
    timestamp: '28 min ago',
    type: 'Security'
  },
  {
    id: '4',
    title: 'Duplicate Payment Detected',
    description: 'Same invoice processed twice',
    severity: 'critical',
    timestamp: '45 min ago',
    type: 'Fraud'
  },
]

export function AlertsPanel() {
  return (
    <Card className="p-6 h-full">
      <h2 className="text-lg font-semibold text-foreground mb-4">Recent Alerts</h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border ${
              alert.severity === 'critical' 
                ? 'bg-destructive/5 border-destructive/20'
                : 'bg-warning/5 border-warning/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded ${
                alert.severity === 'critical' 
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning/10 text-warning'
              }`}>
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                </div>
              </div>
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded whitespace-nowrap">
                {alert.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
