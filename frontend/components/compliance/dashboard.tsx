'use client'

import { ComplianceMetrics } from './compliance-metrics'
import { RegulationStatus } from './regulation-status'
import { AuditTrail } from './audit-trail'
import { ReportGenerator } from './report-generator'

export function ComplianceDashboard() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <ComplianceMetrics />

      {/* Charts & Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RegulationStatus />
        <ReportGenerator />
      </div>

      {/* Audit Trail */}
      <div>
        <AuditTrail />
      </div>
    </div>
  )
}
