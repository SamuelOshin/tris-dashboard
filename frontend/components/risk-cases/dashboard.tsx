'use client'

import { RiskCasesMetrics } from './risk-cases-metrics'
import { AnomalyChart } from '@/components/fraud-detection/anomaly-chart'
import { AnomalyPatterns } from '@/components/fraud-detection/anomaly-patterns'
import { SuspiciousTransactions } from '@/components/fraud-detection/suspicious-transactions'

export function RiskCasesDashboard() {
  return (
    <div className="space-y-6">
      {/* 5 Rich KPI Cards matching sample dashboard */}
      <RiskCasesMetrics />

      {/* Analytical Charts & Detection Rules Context */}
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
