import { DashboardLayout } from '@/components/dashboard-layout'
import { SupplierDashboard } from '@/components/suppliers/dashboard'

export const metadata = {
  title: 'Supplier Risk Management - TRIS',
  description: 'Real-time supplier health and diversification monitoring',
}

export default function SuppliersPage() {
  return (
    <DashboardLayout
      title="Supplier Risk Management"
      description="Supply chain resilience and diversification monitoring"
    >
      <SupplierDashboard />
    </DashboardLayout>
  )
}
