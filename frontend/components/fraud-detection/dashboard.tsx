'use client'

import { FraudMetrics } from './fraud-metrics'
import { AnomalyChart } from './anomaly-chart'
import { SuspiciousTransactions } from './suspicious-transactions'
import { AnomalyPatterns } from './anomaly-patterns'

export function FraudDetectionDashboard() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <FraudMetrics />

      {/* Charts & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnomalyChart />
        </div>
        <div className="lg:col-span-1">
          <AnomalyPatterns />
        </div>
      </div>

      {/* Cases Ledger Table */}
      <div>
        <SuspiciousTransactions />
      </div>
    </div>
  )
}
