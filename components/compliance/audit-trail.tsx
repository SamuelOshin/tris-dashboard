'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'

interface AuditEvent {
  id: string
  timestamp: string
  user: string
  action: string
  resource: string
  status: 'success' | 'failure'
  details: string
}

const auditEvents: AuditEvent[] = [
  {
    id: '1',
    timestamp: '2024-11-14 14:32:18',
    user: 'sarah@company.com',
    action: 'Access',
    resource: 'Financial Reports',
    status: 'success',
    details: 'View permission granted'
  },
  {
    id: '2',
    timestamp: '2024-11-14 14:28:45',
    user: 'john@company.com',
    action: 'Export',
    resource: 'Compliance Data',
    status: 'success',
    details: 'CSV export completed'
  },
  {
    id: '3',
    timestamp: '2024-11-14 14:15:22',
    user: 'maria@company.com',
    action: 'Modify',
    resource: 'Risk Scores',
    status: 'success',
    details: 'Updated supplier risk assessment'
  },
  {
    id: '4',
    timestamp: '2024-11-14 14:02:10',
    user: 'david@company.com',
    action: 'Access',
    resource: 'Zero-Trust Logs',
    status: 'failure',
    details: 'Insufficient permissions'
  },
  {
    id: '5',
    timestamp: '2024-11-14 13:45:33',
    user: 'alex@company.com',
    action: 'Report',
    resource: 'Compliance Summary',
    status: 'success',
    details: 'Generated monthly report'
  },
  {
    id: '6',
    timestamp: '2024-11-14 13:30:15',
    user: 'sarah@company.com',
    action: 'Approve',
    resource: 'Audit Finding',
    status: 'success',
    details: 'Marked as resolved'
  },
]

export function AuditTrail() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Audit Trail</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Timestamp</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">User</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Action</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Resource</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((event) => (
              <tr key={event.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs font-mono">{event.timestamp}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-foreground text-xs">{event.user}</td>
                <td className="py-3 px-4">
                  <Badge className="bg-secondary text-secondary-foreground text-xs">
                    {event.action}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-foreground text-xs">{event.resource}</td>
                <td className="py-3 px-4 text-center">
                  <Badge className={`${
                    event.status === 'success'
                      ? 'bg-success/20 text-success'
                      : 'bg-destructive/20 text-destructive'
                  }`}>
                    {event.status === 'success' ? '✓' : '✗'} {event.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{event.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
