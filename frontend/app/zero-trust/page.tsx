import { DashboardLayout } from '@/components/dashboard-layout'
import { ZeroTrustDashboard } from '@/components/zero-trust/dashboard'

export const metadata = {
  title: 'Access Event Monitoring - TRIS',
  description: 'Access pattern monitoring and off-hours event context',
}

export default function ZeroTrustPage() {
  return (
    <DashboardLayout
      title="Access Event Monitoring"
      description="Access pattern review and off-hours event context"
    >
      <ZeroTrustDashboard />
    </DashboardLayout>
  )
}
