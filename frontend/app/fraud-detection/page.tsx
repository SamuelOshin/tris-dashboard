import { DashboardLayout } from '@/components/dashboard-layout'
import { FraudDetectionDashboard } from '@/components/fraud-detection/dashboard'

export const metadata = {
  title: 'Risk Detection & Anomaly Intelligence - TRIS',
  description: 'Real-time anomaly detection and risk intelligence for enterprise procurement',
}

export default function FraudDetectionPage() {
  return (
    <DashboardLayout
      title="Risk Detection & Anomaly Intelligence"
      description="Real-time anomaly detection and invoice risk analysis"
    >
      <FraudDetectionDashboard />
    </DashboardLayout>
  )
}
