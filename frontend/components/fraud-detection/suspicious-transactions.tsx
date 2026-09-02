'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, RiskCase, getCompositeScore } from '@/lib/api'
import {
  Search,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

export function SuspiciousTransactions() {
  const [cases, setCases] = useState<RiskCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchCases = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCases()
      setCases(data)
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve case intelligence ledger.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCases()
  }, [])

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, priorityFilter, pageSize])

  const filtered = cases.filter((c) => {
    const matchesSearch =
      c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.supplier_id && c.supplier_id.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus =
      statusFilter === 'all' || c.status.toLowerCase() === statusFilter.toLowerCase()

    const matchesPriority =
      priorityFilter === 'all' || c.priority.toLowerCase() === priorityFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesPriority
  })

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, filtered.length)

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by case ID, transaction, or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-card border-border"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 pl-3 pr-8 bg-card border border-border rounded-lg text-xs text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-sans"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 pl-3 pr-8 bg-card border border-border rounded-lg text-xs text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-sans"
            >
              <option value="all">All Lifecycle States</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="under investigation">Under Investigation</option>
              <option value="corrective action">Corrective Action</option>
              <option value="pending verification">Pending Verification</option>
              <option value="closed">Closed</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button variant="outline" size="sm" onClick={fetchCases} disabled={loading} className="h-9 text-xs gap-1.5 font-mono">
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="p-6 border-destructive/20 bg-destructive/5 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <h4 className="font-semibold text-foreground text-sm">Failed to Load Case Ledger</h4>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCases} className="mx-auto text-xs">
            Retry Connection
          </Button>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card className="p-6 space-y-3 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="h-4 bg-muted/40 rounded-lg w-1/4 animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted/20 rounded-xl animate-pulse" />
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="p-12 text-center space-y-4 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto opacity-60" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">No Flagged Cases Found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No cases match your active filters. Try clearing search parameters.'
                : 'There are currently no active anomaly cases. You can run synthetic ingestion to generate test cases.'}
            </p>
          </div>
          {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setPriorityFilter('all')
              }}
              className="text-xs rounded-xl"
            >
              Clear Filters
            </Button>
          ) : (
            <Link href="/ingestion">
              <Button size="sm" className="text-xs gap-1.5 mx-auto rounded-xl">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Ingest Synthetic Dataset
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
                  <th className="py-3 px-4">Case Identifier</th>
                  <th className="py-3 px-4">Target Invoice</th>
                  <th className="py-3 px-4">Severity Tier</th>
                  <th className="py-3 px-4">Composite Score</th>
                  <th className="py-3 px-4">Lifecycle State</th>
                  <th className="py-3 px-4 text-right">Investigation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {paginated.map((c) => {
                  const score = getCompositeScore(c)
                  const isHigh = c.priority?.toLowerCase() === 'high' || score >= 70

                  return (
                    <tr key={c.case_id} className="hover:bg-muted/15 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground font-mono">{c.case_id}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{c.case_number}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-semibold text-foreground text-xs">{c.transaction_id}</span>
                        <div className="text-[11px] text-muted-foreground font-sans">
                          Supplier: <strong className="text-foreground">{c.supplier_id || 'N/A'}</strong>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border uppercase ${
                            isHigh
                              ? 'bg-destructive/15 text-destructive border-destructive/30'
                              : 'bg-warning/15 text-warning border-warning/30'
                          }`}
                        >
                          {c.priority} Priority
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold text-sm ${
                              score >= 70
                                ? 'text-destructive'
                                : score >= 30
                                ? 'text-warning'
                                : 'text-success'
                            }`}
                          >
                            {score}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-sans">/ 100</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                            c.status === 'Closed'
                              ? 'bg-success/10 text-success border-success/20'
                              : c.status === 'Pending Verification'
                              ? 'bg-warning/10 text-warning border-warning/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.status === 'Closed'
                                ? 'bg-success'
                                : c.status === 'Pending Verification'
                                ? 'bg-warning animate-pulse'
                                : 'bg-primary'
                            }`}
                          />
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link href={`/cases/${c.case_id}`}>
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs gap-1.5 font-medium ml-auto bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 shadow-xs"
                          >
                            Investigate
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Bounded Pagination Bar */}
          <div className="p-3 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                Showing <strong className="text-foreground font-mono">{startIndex}</strong>–
                <strong className="text-foreground font-mono">{endIndex}</strong> of{' '}
                <strong className="text-foreground font-mono">{filtered.length}</strong> cases
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
    </div>
  )
}
