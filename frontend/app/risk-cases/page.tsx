import { DashboardLayout } from '@/components/dashboard-layout'
import { RiskCasesDashboard } from '@/components/risk-cases/dashboard'

export const metadata = {
  title: 'Risk Review Dashboard - TRIS',
  description: 'Overview of risk cases and current status',
}

export default function RiskCasesPage() {
  return (
    <DashboardLayout
      title="Risk Review Dashboard"
      description="Overview of risk cases and current status"
    >
      <RiskCasesDashboard />
    </DashboardLayout>
  )
}
