'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, Supplier, BaselineStats } from '@/lib/api'
import {
  Eye,
  Search,
  AlertTriangle,
  RotateCcw,
  Building2,
  Calendar,
  CreditCard,
  Calculator,
  XCircle,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react'
import Link from 'next/link'

export function SupplierTable() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTier, setSelectedTier] = useState<string>('all')

  // Slideout Baseline Drawer
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null)
  const [baselineData, setBaselineData] = useState<BaselineStats | null>(null)
  const [baselineLoading, setBaselineLoading] = useState(false)
  const [baselineError, setBaselineError] = useState<string | null>(null)

  const fetchSuppliers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSuppliers()
      setSuppliers(data)
    } catch (err: any) {
      setError(err.message || 'Unable to connect to supplier directory service.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const handleOpenBaseline = async (supplier: Supplier) => {
    setActiveSupplier(supplier)
    setBaselineData(null)
    setBaselineLoading(true)
    setBaselineError(null)

    try {
      // For SUP-001, exclude TX-1999 to show strict target exclusion
      const excludeTx = supplier.supplier_id === 'SUP-001' ? 'TX-1999' : undefined
      const stats = await api.getSupplierBaseline(supplier.supplier_id, excludeTx)
      setBaselineData(stats)
    } catch (err: any) {
      setBaselineError(err.message || 'Failed to compute descriptive statistics baseline.')
    } finally {
      setBaselineLoading(false)
    }
  }

  // Filtered suppliers
  const filtered = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.supplier_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesTier =
      selectedTier === 'all' || s.risk_tier.toLowerCase() === selectedTier.toLowerCase()

    return matchesSearch && matchesTier
  })

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search suppliers by name, ID, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Risk Tiers</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchSuppliers} disabled={loading}>
            <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-destructive/20 bg-destructive/5 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <h4 className="font-semibold text-foreground">Failed to Load Suppliers</h4>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchSuppliers} className="mx-auto">
            Retry Connection
          </Button>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card className="p-6 space-y-4">
          <div className="h-6 bg-muted/40 rounded w-1/4 animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/20 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="p-12 text-center space-y-4">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-bold text-foreground">No Suppliers Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {searchQuery || selectedTier !== 'all'
              ? 'No suppliers match your active search filters. Try clearing your query.'
              : 'No suppliers are currently loaded in the database. You can ingest synthetic test data.'}
          </p>
          {searchQuery || selectedTier !== 'all' ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setSelectedTier('all')
              }}
            >
              Clear Filters
            </Button>
          ) : (
            <Link href="/ingestion">
              <Button className="flex items-center gap-2 mx-auto">
                <FileSpreadsheet className="w-4 h-4" />
                Go to Data Ingestion Pipeline
              </Button>
            </Link>
          )}
        </Card>
      )}

      {/* Live Table */}
      {!loading && !error && filtered.length > 0 && (
        <Card className="overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Risk Tier</th>
                  <th className="p-4">Bank Modification</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((sup) => (
                  <tr key={sup.supplier_id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-foreground">{sup.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{sup.supplier_id}</div>
                    </td>
                    <td className="p-4 text-muted-foreground">{sup.category}</td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={
                          sup.risk_tier.toLowerCase() === 'high'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : sup.risk_tier.toLowerCase() === 'medium'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-success/10 text-success border-success/20'
                        }
                      >
                        {sup.risk_tier} Risk
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {sup.bank_change_date ? (
                        <div className="flex items-center gap-1.5 text-xs text-warning font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{sup.bank_change_date}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">None logged</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                        {sup.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenBaseline(sup)}
                        className="flex items-center gap-1.5 ml-auto"
                      >
                        <Calculator className="w-3.5 h-3.5 text-primary" />
                        Inspect Baseline
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Supplier Baseline Slideout Drawer */}
      {activeSupplier && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="font-bold text-foreground text-lg">{activeSupplier.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground">{activeSupplier.supplier_id} · {activeSupplier.category}</p>
                </div>
                <button
                  onClick={() => setActiveSupplier(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Baseline Loading */}
              {baselineLoading && (
                <div className="text-center py-12 space-y-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground">Calculating sample statistics baseline...</p>
                </div>
              )}

              {/* Baseline Error */}
              {baselineError && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-xs space-y-2">
                  <AlertTriangle className="w-4 h-4" />
                  <p>{baselineError}</p>
                </div>
              )}

              {/* Baseline Data Cards */}
              {baselineData && !baselineLoading && (
                <div className="space-y-4">
                  {/* Strict Target Exclusion Banner */}
                  {baselineData.excluded_transaction_id && (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs space-y-1">
                      <div className="font-semibold text-primary flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        Target Exclusion Protocol Active
                      </div>
                      <p className="text-muted-foreground">
                        Transaction <code className="font-mono text-foreground">{baselineData.excluded_transaction_id}</code> ($104,000.00) is strictly excluded from descriptive baseline to avoid bias.
                      </p>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Card className="p-3">
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold">Mean Invoice</span>
                      <p className="text-xl font-bold text-foreground mt-1">
                        ${baselineData.mean_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-muted-foreground">Sample average</span>
                    </Card>

                    <Card className="p-3">
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold">Median Invoice</span>
                      <p className="text-xl font-bold text-foreground mt-1">
                        ${baselineData.median_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-muted-foreground">Midpoint value</span>
                    </Card>

                    <Card className="p-3">
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold">Std Deviation</span>
                      <p className="text-xl font-bold text-foreground mt-1">
                        ${baselineData.std_dev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-muted-foreground">Variance control</span>
                    </Card>

                    <Card className="p-3">
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold">Baseline Invoices</span>
                      <p className="text-xl font-bold text-foreground mt-1">
                        {baselineData.invoice_count}
                      </p>
                      <span className="text-[10px] text-muted-foreground">Qualified transactions</span>
                    </Card>
                  </div>

                  {/* Min / Max Range */}
                  <div className="p-3 bg-muted/20 rounded-lg text-xs flex justify-between items-center">
                    <div>
                      <span className="text-muted-foreground">Historical Min: </span>
                      <span className="font-semibold text-foreground">${baselineData.min_amount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Historical Max: </span>
                      <span className="font-semibold text-foreground">${baselineData.max_amount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Baseline Invoices List */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Included Baseline Transactions ({baselineData.baseline_transaction_ids.length})
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {baselineData.baseline_transaction_ids.map((txId) => (
                        <span key={txId} className="px-2 py-0.5 bg-muted rounded font-mono text-xs text-foreground">
                          {txId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => setActiveSupplier(null)}>
              Close Drawer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
