import { DashboardLayout } from '@/components/dashboard-layout'
import { ComplianceDashboard } from '@/components/compliance/dashboard'

export const metadata = {
  title: 'Compliance & Reporting - TRIS',
  description: 'Regulatory compliance and audit trail reporting',
}

export default function CompliancePage() {
  return (
    <DashboardLayout
      title="Compliance & Reporting"
      description="Regulatory audits, compliance status, and automated reporting"
    >
      <ComplianceDashboard />
    </DashboardLayout>
  )
}
