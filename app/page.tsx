'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { OverviewDashboard } from '@/components/overview-dashboard'
import { RiskMetrics } from '@/components/risk-metrics'
import { AlertsPanel } from '@/components/alerts-panel'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TRIS...</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout
      title={`Welcome back, ${user.name}`}
      description={
        user.role === 'cfo' && 'Financial Fraud Detection & Risk Monitoring' ||
        user.role === 'procurement' && 'Supplier Risk Management & Compliance' ||
        user.role === 'compliance' && 'Audit Trails & Regulatory Reporting' ||
        user.role === 'security' && 'Zero-Trust Access & Threat Detection' ||
        user.role === 'admin' && 'System Overview & Administration' ||
        ''
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <RiskMetrics />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <OverviewDashboard />
            </div>
            <div>
              <AlertsPanel />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
