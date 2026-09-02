import { DashboardLayout } from '@/components/dashboard-layout'
import { FraudDetectionDashboard } from '@/components/fraud-detection/dashboard'

export const metadata = {
  title: 'Financial Fraud Detection - TRIS',
  description: 'Real-time financial anomaly detection and fraud prevention',
}

export default function FraudDetectionPage() {
  return (
    <DashboardLayout
      title="Financial Fraud Detection"
      description="Real-time anomaly detection and invoice verification"
    >
      <FraudDetectionDashboard />
    </DashboardLayout>
  )
}
