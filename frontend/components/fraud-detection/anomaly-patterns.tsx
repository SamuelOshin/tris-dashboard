'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

interface Pattern {
  name: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  count: number
}

const patterns: Pattern[] = [
  {
    name: 'Duplicate Invoices',
    description: 'Same invoice number processed twice',
    severity: 'critical',
    count: 3
  },
  {
    name: 'Amount Spikes',
    description: 'Transaction 300%+ above average',
    severity: 'warning',
    count: 8
  },
  {
    name: 'Unusual Vendors',
    description: 'New vendor, high transaction volume',
    severity: 'warning',
    count: 5
  },
  {
    name: 'Off-Hours Processing',
    description: 'Transactions outside business hours',
    severity: 'info',
    count: 12
  },
  {
    name: 'Duplicate Payments',
    description: 'Multiple payments to same vendor',
    severity: 'critical',
    count: 2
  },
  {
    name: 'Account Mismatch',
    description: 'Invoice account != payment account',
    severity: 'warning',
    count: 6
  }
]

export function AnomalyPatterns() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Detected Patterns</h2>
      <div className="space-y-3">
        {patterns.map((pattern) => (
          <div key={pattern.name} className="p-3 rounded-lg bg-secondary/30 border border-secondary">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {pattern.severity === 'critical' && (
                    <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0"></div>
                  )}
                  {pattern.severity === 'warning' && (
                    <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0"></div>
                  )}
                  {pattern.severity === 'info' && (
                    <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0"></div>
                  )}
                  <p className="font-medium text-sm text-foreground">{pattern.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
              </div>
              <Badge className="bg-secondary text-secondary-foreground text-xs">{pattern.count}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
