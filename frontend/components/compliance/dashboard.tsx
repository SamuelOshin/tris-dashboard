'use client'

import { Card } from '@/components/ui/card'
import { ComplianceMetrics } from './compliance-metrics'
import { RegulationStatus } from './regulation-status'
import { AuditTrail } from './audit-trail'
import { ReportGenerator } from './report-generator'

export function ComplianceDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Compliance & Reporting</h1>
          <p className="text-muted-foreground mt-1">Regulatory audits, compliance status, and automated reporting</p>
        </div>

        {/* Key Metrics */}
        <ComplianceMetrics />

        {/* Charts & Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <RegulationStatus />
          <ReportGenerator />
        </div>

        {/* Audit Trail */}
        <div className="mt-6">
          <AuditTrail />
        </div>
      </div>
    </div>
  )
}
