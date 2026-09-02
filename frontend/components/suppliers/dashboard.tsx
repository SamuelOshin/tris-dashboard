'use client'

import { SupplierMetrics } from './supplier-metrics'
import { SupplierPortfolio } from './supplier-portfolio'
import { RiskMatrix } from './risk-matrix'
import { SupplierTable } from './supplier-table'

export function SupplierDashboard() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <SupplierMetrics />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupplierPortfolio />
        <RiskMatrix />
      </div>

      {/* Supplier Table & Baseline Drawer */}
      <div>
        <SupplierTable />
      </div>
    </div>
  )
}
