'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Mail, Share2, Calendar, FileText } from 'lucide-react'
import { format } from 'date-fns'

interface Report {
  id: string
  title: string
  type: 'fraud' | 'supplier' | 'access' | 'compliance'
  period: string
  status: 'completed' | 'pending' | 'failed'
  createdAt: Date
  size: string
}

const sampleReports: Report[] = [
  {
    id: '1',
    title: 'Financial Risk Analysis - Q2 2024',
    type: 'fraud',
    period: 'Q2 2024',
    status: 'completed',
    createdAt: new Date('2024-06-30'),
    size: '4.2 MB',
  },
  {
    id: '2',
    title: 'Supplier Risk Assessment - June 2024',
    type: 'supplier',
    period: 'June 2024',
    status: 'completed',
    createdAt: new Date('2024-06-28'),
    size: '3.8 MB',
  },
  {
    id: '3',
    title: 'Zero-Trust Access Audit - Q2 2024',
    type: 'access',
    period: 'Q2 2024',
    status: 'completed',
    createdAt: new Date('2024-06-27'),
    size: '2.1 MB',
  },
  {
    id: '4',
    title: 'SOX Compliance Report - Q2 2024',
    type: 'compliance',
    period: 'Q2 2024',
    status: 'pending',
    createdAt: new Date('2024-06-25'),
    size: '5.6 MB',
  },
]

const typeColors = {
  fraud: 'bg-red-500/10 text-red-700 dark:text-red-400',
  supplier: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  access: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  compliance: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
}

const statusColors = {
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export default function ReportsPage() {
  return (
    <DashboardLayout
      title="Reports & Analytics"
      description="Generate and download comprehensive risk analysis reports"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Report Generation */}
          <Card>
            <CardHeader>
              <CardTitle>Generate New Report</CardTitle>
              <CardDescription>Create custom reports for fraud, supplier, or compliance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Fraud Detection', 'Supplier Risk', 'Access Audit', 'Compliance'].map((report) => (
                  <Button key={report} variant="outline" className="h-auto flex flex-col items-center gap-2 py-4">
                    <FileText className="w-5 h-5" />
                    <span>{report}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Download or share your generated reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sampleReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{report.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={`text-xs ${typeColors[report.type]}`}>
                            {report.type}
                          </Badge>
                          <Badge variant="secondary" className={`text-xs ${statusColors[report.status]}`}>
                            {report.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{report.size}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(report.createdAt, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
