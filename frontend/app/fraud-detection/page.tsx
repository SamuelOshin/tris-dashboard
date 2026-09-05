import { DashboardLayout } from '@/components/dashboard-layout'
import { FraudDetectionDashboard } from '@/components/fraud-detection/dashboard'

export const metadata = {
  title: 'Risk Cases & Prioritization - TRIS',
  description: 'Structured risk exception review and prioritized investigation',
}

export default function FraudDetectionPage() {
  return (
    <DashboardLayout
      title="Risk Cases & Prioritization"
      description="Structured risk exception review and prioritized investigation"
    >
      <FraudDetectionDashboard />
    </DashboardLayout>
  )
}
