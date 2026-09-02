'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

interface Regulation {
  name: string
  framework: string
  status: 'compliant' | 'warning' | 'non-compliant'
  lastAudit: string
  nextAudit: string
}

const regulations: Regulation[] = [
  {
    name: 'SOX (Sarbanes-Oxley)',
    framework: 'Financial Reporting',
    status: 'compliant',
    lastAudit: '2024-10-15',
    nextAudit: '2025-01-15'
  },
  {
    name: 'GDPR Compliance',
    framework: 'Data Protection',
    status: 'compliant',
    lastAudit: '2024-11-01',
    nextAudit: '2025-02-01'
  },
  {
    name: 'ISO 27001',
    framework: 'Information Security',
    status: 'warning',
    lastAudit: '2024-09-20',
    nextAudit: '2024-12-20'
  },
  {
    name: 'PCI DSS',
    framework: 'Payment Security',
    status: 'compliant',
    lastAudit: '2024-11-10',
    nextAudit: '2025-05-10'
  },
  {
    name: 'HIPAA (if applicable)',
    framework: 'Healthcare Data',
    status: 'non-compliant',
    lastAudit: '2024-08-30',
    nextAudit: '2024-12-30'
  },
]

export function RegulationStatus() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Regulatory Framework Status</h2>
      <div className="space-y-3">
        {regulations.map((reg) => (
          <div key={reg.name} className="p-4 rounded-lg border border-border hover:border-secondary transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-1">
                {reg.status === 'compliant' && (
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                )}
                {reg.status === 'warning' && (
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
                )}
                {reg.status === 'non-compliant' && (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{reg.name}</p>
                  <p className="text-xs text-muted-foreground">{reg.framework}</p>
                </div>
              </div>
              <Badge className={`flex-shrink-0 ${
                reg.status === 'compliant' ? 'bg-success/20 text-success' :
                reg.status === 'warning' ? 'bg-warning/20 text-warning' :
                'bg-destructive/20 text-destructive'
              }`}>
                {reg.status === 'compliant' ? 'Compliant' :
                 reg.status === 'warning' ? 'Warning' :
                 'Non-Compliant'}
              </Badge>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Last: {reg.lastAudit}</span>
              <span>·</span>
              <span>Next: {reg.nextAudit}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
