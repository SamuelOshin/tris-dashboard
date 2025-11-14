'use client'

import { Card } from '@/components/ui/card'
import { FraudMetrics } from './fraud-metrics'
import { AnomalyChart } from './anomaly-chart'
import { SuspiciousTransactions } from './suspicious-transactions'
import { AnomalyPatterns } from './anomaly-patterns'

export function FraudDetectionDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Financial Fraud Detection</h1>
          <p className="text-muted-foreground mt-1">Real-time anomaly detection and invoice verification</p>
        </div>

        {/* Key Metrics */}
        <FraudMetrics />

        {/* Charts & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <AnomalyChart />
          </div>
          <div>
            <AnomalyPatterns />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="mt-6">
          <SuspiciousTransactions />
        </div>
      </div>
    </div>
  )
}
