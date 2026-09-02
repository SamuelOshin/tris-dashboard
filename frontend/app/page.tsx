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
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-mono">Loading TRIS Executive Studio...</p>
        </div>
      </div>
    )
  }

  const roleDescriptions: Record<string, string> = {
    cfo: 'Executive Risk Oversight · Forensic Ingestion Ledger · Additive Scoring Engine',
    procurement: 'Supplier Resilience Monitoring · Variance Baselines · Bank Surveillance',
    compliance: 'Immutable Audit Trails · SOX Framework Governance · 8-Field Closure Gates',
    security: 'Zero-Trust Telemetry · Off-Hours Access Surveillance · Heuristic Evaluation',
    admin: 'Multi-Tenant Risk Studio Administration · Engine Metrics · Acceptance Gates',
  }

  return (
    <DashboardLayout
      title={`Welcome Back, ${user.name} !`}
      description={roleDescriptions[user.role?.toLowerCase()] || 'Enterprise Risk Intelligence & Anomaly Detection Studio'}
    >
      <div className="space-y-6">
        {/* Top KPI Metrics Row: Borderless elevated cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <RiskMetrics />
        </div>

        {/* Executive Workspace: 2-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <OverviewDashboard />
          </div>
          <div className="lg:col-span-1">
            <AlertsPanel />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
