'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDown, Mail, Share2 } from 'lucide-react'

interface Report {
  name: string
  frequency: string
  lastGenerated: string
  recipients: number
}

const reports: Report[] = [
  {
    name: 'Monthly Risk Assessment',
    frequency: 'Monthly',
    lastGenerated: '2024-11-01',
    recipients: 5
  },
  {
    name: 'Quarterly Compliance Summary',
    frequency: 'Quarterly',
    lastGenerated: '2024-10-01',
    recipients: 8
  },
  {
    name: 'Annual Audit Report',
    frequency: 'Annually',
    lastGenerated: '2024-01-15',
    recipients: 12
  },
  {
    name: 'Incident Report (On-Demand)',
    frequency: 'As Needed',
    lastGenerated: '2024-11-12',
    recipients: 3
  },
]

export function ReportGenerator() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Automated Reports</h2>
      <div className="space-y-3">
        {reports.map((report) => (
          <div key={report.name} className="p-4 rounded-lg border border-border">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-foreground">{report.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.frequency} · {report.recipients} recipients
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <FileDown className="w-3 h-3 mr-1" />
                Download
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Mail className="w-3 h-3 mr-1" />
                Email
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Share2 className="w-3 h-3 mr-1" />
                Share
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last generated: {report.lastGenerated}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
