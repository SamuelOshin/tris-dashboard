import { DashboardLayout } from '@/components/dashboard-layout'
import { ZeroTrustDashboard } from '@/components/zero-trust/dashboard'

export const metadata = {
  title: 'Zero-Trust Access Monitoring - TRIS',
  description: 'Access pattern monitoring and internal threat detection',
}

export default function ZeroTrustPage() {
  return (
    <DashboardLayout
      title="Zero-Trust Access Monitoring"
      description="Real-time access pattern analysis and internal threat detection"
    >
      <ZeroTrustDashboard />
    </DashboardLayout>
  )
}
