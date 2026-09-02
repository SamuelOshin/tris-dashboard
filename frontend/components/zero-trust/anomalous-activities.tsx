'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock } from 'lucide-react'

interface Activity {
  id: string
  user: string
  action: string
  resource: string
  timestamp: string
  severity: 'critical' | 'warning' | 'info'
  details: string
}

const activities: Activity[] = [
  {
    id: '1',
    user: 'john.smith@company.com',
    action: 'Access Denied',
    resource: 'Financial Reports Database',
    timestamp: '2 min ago',
    severity: 'critical',
    details: 'Attempted access without proper clearance'
  },
  {
    id: '2',
    user: 'maria.rodriguez@company.com',
    action: 'Privilege Escalation',
    resource: 'Admin Console',
    timestamp: '8 min ago',
    severity: 'critical',
    details: 'Elevated permissions requested outside change window'
  },
  {
    id: '3',
    user: 'sarah.chen@company.com',
    action: 'Data Export',
    resource: 'Customer Database',
    timestamp: '15 min ago',
    severity: 'warning',
    details: 'Large dataset (1.2GB) exported during off-hours'
  },
  {
    id: '4',
    user: 'david.kim@company.com',
    action: 'Lateral Movement',
    resource: 'Production System',
    timestamp: '23 min ago',
    severity: 'info',
    details: 'Accessed system outside normal network path'
  },
  {
    id: '5',
    user: 'alex.morgan@company.com',
    action: 'Credential Sharing',
    resource: 'Multiple Resources',
    timestamp: '34 min ago',
    severity: 'warning',
    details: 'Account used from 3 different locations simultaneously'
  },
]

export function AnomalousActivities() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Recent Access Violations</h2>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`p-4 rounded-lg border ${
              activity.severity === 'critical' 
                ? 'bg-destructive/5 border-destructive/20'
                : activity.severity === 'warning'
                ? 'bg-warning/5 border-warning/20'
                : 'bg-accent/5 border-accent/20'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  activity.severity === 'critical'
                    ? 'bg-destructive/10 text-destructive'
                    : activity.severity === 'warning'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-accent/10 text-accent'
                }`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{activity.user}</p>
                    <span className="text-xs text-muted-foreground">·</span>
                    <p className="font-semibold text-sm text-foreground">{activity.action}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{activity.resource}</p>
                  <p className="text-xs text-muted-foreground mt-2">{activity.details}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                  </div>
                </div>
              </div>
              <Badge className={`flex-shrink-0 ${
                activity.severity === 'critical'
                  ? 'bg-destructive/20 text-destructive'
                  : activity.severity === 'warning'
                  ? 'bg-warning/20 text-warning'
                  : 'bg-accent/20 text-accent'
              }`}>
                {activity.severity.charAt(0).toUpperCase() + activity.severity.slice(1)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
