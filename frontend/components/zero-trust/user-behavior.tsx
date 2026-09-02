'use client'

import { Card } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

interface BehaviorFlag {
  name: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  count: number
}

const behaviorFlags: BehaviorFlag[] = [
  {
    name: 'Off-Hours Access',
    description: 'Data access outside business hours',
    severity: 'warning',
    count: 8
  },
  {
    name: 'Unusual Location',
    description: 'Access from unexpected geography',
    severity: 'critical',
    count: 3
  },
  {
    name: 'Privilege Escalation',
    description: 'Temporary elevated permissions used',
    severity: 'critical',
    count: 2
  },
  {
    name: 'Data Exfiltration',
    description: 'Large file transfers detected',
    severity: 'warning',
    count: 5
  },
  {
    name: 'Lateral Movement',
    description: 'Cross-system access patterns',
    severity: 'info',
    count: 11
  },
]

export function UserBehavior() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Behavior Anomalies</h2>
      <div className="space-y-3">
        {behaviorFlags.map((flag) => (
          <div key={flag.name} className="p-3 rounded-lg bg-secondary/30 border border-secondary">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    flag.severity === 'critical' ? 'bg-destructive' :
                    flag.severity === 'warning' ? 'bg-warning' :
                    'bg-accent'
                  }`}></div>
                  <p className="font-medium text-sm text-foreground">{flag.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
              </div>
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded whitespace-nowrap font-semibold">
                {flag.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
