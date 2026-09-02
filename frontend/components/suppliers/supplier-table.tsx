'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, Supplier, BaselineStats, formatCurrency } from '@/lib/api'
import {
  Search,
  AlertTriangle,
  RotateCcw,
  Building2,
  Calendar,
  Calculator,
  X,
  ShieldCheck,
  FileSpreadsheet,
  TrendingDown,
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

export function SupplierTable() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTier, setSelectedTier] = useState<string>('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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

  // Reset to page 1 on filter/size change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedTier, pageSize])

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

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, filtered.length)

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendor, ID, or sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative">
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="h-9 pl-3 pr-8 bg-card border border-border rounded-lg text-xs text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Risk Tiers</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button variant="outline" size="sm" onClick={fetchSuppliers} disabled={loading} className="h-9 text-xs gap-1.5 font-mono">
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-destructive/20 bg-destructive/5 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <h4 className="font-semibold text-foreground text-sm">Failed to Load Suppliers</h4>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchSuppliers} className="mx-auto text-xs">
            Retry Connection
          </Button>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card className="p-6 space-y-3 bg-card border-border">
          <div className="h-4 bg-muted/40 rounded w-1/4 animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-muted/20 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="p-12 text-center space-y-4 bg-card border-border">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto opacity-60" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">No Suppliers Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || selectedTier !== 'all'
                ? 'No vendors match your active search filters.'
                : 'No supplier profiles loaded. You can ingest synthetic test data.'}
            </p>
          </div>
          {searchQuery || selectedTier !== 'all' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSelectedTier('all')
              }}
              className="text-xs"
            >
              Clear Filters
            </Button>
          ) : (
            <Link href="/ingestion">
              <Button size="sm" className="text-xs gap-1.5 mx-auto">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Go to Ingestion Pipeline
              </Button>
            </Link>
          )}
        </Card>
      )}

      {/* Live Paginated Table */}
      {!loading && !error && filtered.length > 0 && (
        <Card className="overflow-hidden bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/15 text-muted-foreground/70 font-mono font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Supplier Entity</th>
                  <th className="py-3 px-4">Industry Sector</th>
                  <th className="py-3 px-4">Risk Stratification</th>
                  <th className="py-3 px-4">Bank Surveillance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Baseline Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {paginated.map((sup) => (
                  <tr key={sup.supplier_id} className="hover:bg-muted/15 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{sup.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{sup.supplier_id}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-medium">{sup.category}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                          sup.risk_tier.toLowerCase() === 'high'
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : sup.risk_tier.toLowerCase() === 'medium'
                            ? 'bg-warning/15 text-warning border-warning/30'
                            : 'bg-success/15 text-success border-success/30'
                        }`}
                      >
                        {sup.risk_tier} Risk
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono">
                      {sup.bank_change_date ? (
                        <div className="flex items-center gap-1.5 text-xs text-warning font-medium">
                          <Calendar className="w-3 h-3 text-warning" />
                          <span>{sup.bank_change_date}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">Verified Stable</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success border border-success/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        {sup.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenBaseline(sup)}
                        className="h-7 px-2.5 text-xs font-mono gap-1.5 ml-auto text-primary hover:text-primary hover:bg-primary/10 border-primary/20"
                      >
                        <Calculator className="w-3 h-3" />
                        Inspect Baseline
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bounded Pagination Bar */}
          <div className="p-3 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                Showing <strong className="text-foreground font-mono">{startIndex}</strong>–
                <strong className="text-foreground font-mono">{endIndex}</strong> of{' '}
                <strong className="text-foreground font-mono">{filtered.length}</strong> suppliers
              </span>

              <span className="text-border">|</span>

              <div className="flex items-center gap-1 text-[11px]">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-muted/30 border border-border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer font-mono"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>per page</span>
              </div>
            </div>

            {/* Page Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2 text-xs gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </Button>

              <span className="px-2.5 py-1 rounded bg-muted/20 border border-border font-mono text-[11px] text-muted-foreground">
                Page <strong className="text-foreground">{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 px-2 text-xs gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Supplier Baseline Slideout Drawer */}
      {activeSupplier && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-foreground text-base tracking-tight">{activeSupplier.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    {activeSupplier.supplier_id} · <span className="text-foreground">{activeSupplier.category}</span>
                  </p>
                </div>
                <button
                  onClick={() => setActiveSupplier(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Baseline Loading */}
              {baselineLoading && (
                <div className="text-center py-16 space-y-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground font-mono">Computing descriptive statistics baseline...</p>
                </div>
              )}

              {/* Baseline Error */}
              {baselineError && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-xs space-y-2 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4" />
                  <p>{baselineError}</p>
                </div>
              )}

              {/* Baseline Data Cards */}
              {baselineData && !baselineLoading && (
                <div className="space-y-5">
                  {/* Strict Target Exclusion Banner */}
                  {baselineData.excluded_transaction_id && (
                    <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl text-xs space-y-1">
                      <div className="font-semibold text-primary flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        Target Exclusion Protocol Active
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        Transaction <code className="font-mono text-foreground font-semibold px-1 rounded bg-card">{baselineData.excluded_transaction_id}</code> ($104,000.00) is strictly excluded from descriptive baseline to avoid bias.
                      </p>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3.5 rounded-xl bg-muted/15 border border-border/80 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Mean Invoice</span>
                      <p className="text-lg font-bold text-foreground font-mono">
                        {formatCurrency(baselineData.mean_amount)}
                      </p>
                      <span className="text-[10px] text-muted-foreground block">Sample average</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-muted/15 border border-border/80 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Median Invoice</span>
                      <p className="text-lg font-bold text-foreground font-mono">
                        {formatCurrency(baselineData.median_amount)}
                      </p>
                      <span className="text-[10px] text-muted-foreground block">Midpoint value</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-muted/15 border border-border/80 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Std Deviation</span>
                      <p className="text-lg font-bold text-foreground font-mono">
                        {formatCurrency(baselineData.std_dev)}
                      </p>
                      <span className="text-[10px] text-muted-foreground block">Variance control</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-muted/15 border border-border/80 space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Sample Invoices</span>
                      <p className="text-lg font-bold text-foreground font-mono">
                        {baselineData.invoice_count}
                      </p>
                      <span className="text-[10px] text-muted-foreground block">Qualified records</span>
                    </div>
                  </div>

                  {/* Min / Max Range Bar */}
                  <div className="p-3 bg-muted/15 border border-border/60 rounded-xl text-xs flex justify-between items-center font-mono">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Historical Min</span>
                      <span className="font-bold text-foreground">{formatCurrency(baselineData.min_amount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-[10px] block">Historical Max</span>
                      <span className="font-bold text-foreground">{formatCurrency(baselineData.max_amount)}</span>
                    </div>
                  </div>

                  {/* Baseline Invoices Chips (Bounded Scroll Area) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                        Included Baseline Transactions
                      </h5>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {baselineData.baseline_transaction_ids.length} records
                      </span>
                    </div>
                    <div className="max-h-36 overflow-y-auto pr-1 flex flex-wrap gap-1.5 p-1 rounded-lg bg-muted/10 border border-border/50">
                      {baselineData.baseline_transaction_ids.map((txId) => (
                        <span
                          key={txId}
                          className="px-2 py-0.5 bg-card border border-border rounded font-mono text-[11px] text-foreground"
                        >
                          {txId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setActiveSupplier(null)}>
              Close Baseline Inspector
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
