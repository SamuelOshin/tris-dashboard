'use client'

import { Card } from '@/components/ui/card'
import { AccessMetrics } from './access-metrics'
import { AccessTimeline } from './access-timeline'
import { AnomalousActivities } from './anomalous-activities'
import { UserBehavior } from './user-behavior'

export function ZeroTrustDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Zero-Trust Access Monitoring</h1>
          <p className="text-muted-foreground mt-1">Real-time access pattern analysis and internal threat detection</p>
        </div>

        {/* Key Metrics */}
        <AccessMetrics />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <AccessTimeline />
          </div>
          <div>
            <UserBehavior />
          </div>
        </div>

        {/* Anomalous Activities */}
        <div className="mt-6">
          <AnomalousActivities />
        </div>
      </div>
    </div>
  )
}
