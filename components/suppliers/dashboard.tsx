'use client'

import { Card } from '@/components/ui/card'
import { SupplierMetrics } from './supplier-metrics'
import { SupplierPortfolio } from './supplier-portfolio'
import { RiskMatrix } from './risk-matrix'
import { SupplierTable } from './supplier-table'

export function SupplierDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Supplier Risk Management</h1>
          <p className="text-muted-foreground mt-1">Supply chain resilience and diversification monitoring</p>
        </div>

        {/* Key Metrics */}
        <SupplierMetrics />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <SupplierPortfolio />
          <RiskMatrix />
        </div>

        {/* Supplier Table */}
        <div className="mt-6">
          <SupplierTable />
        </div>
      </div>
    </div>
  )
}
