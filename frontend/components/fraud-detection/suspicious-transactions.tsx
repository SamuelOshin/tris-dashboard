'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, RiskCase } from '@/lib/api'
import {
  Search,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
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

  const filtered = cases.filter((c) => {
    const matchesSearch =
      c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.case_number.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || c.status.toLowerCase() === statusFilter.toLowerCase()

    const matchesPriority =
      priorityFilter === 'all' || c.priority.toLowerCase() === priorityFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesPriority
  })

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by case ID or transaction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Lifecycle States</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="under investigation">Under Investigation</option>
            <option value="corrective action">Corrective Action</option>
            <option value="pending verification">Pending Verification</option>
            <option value="closed">Closed</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchCases} disabled={loading}>
            <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="p-6 border-destructive/20 bg-destructive/5 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <h4 className="font-semibold text-foreground">Failed to Load Case Ledger</h4>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchCases} className="mx-auto">
            Retry Connection
          </Button>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card className="p-6 space-y-4">
          <div className="h-6 bg-muted/40 rounded w-1/4 animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="p-12 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-bold text-foreground">No Flagged Cases Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No cases match your active filters. Try clearing search parameters.'
              : 'There are currently no active anomaly cases. You can run synthetic ingestion to generate test cases.'}
          </p>
          {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setPriorityFilter('all')
              }}
            >
              Clear Filters
            </Button>
          ) : (
            <Link href="/ingestion">
              <Button className="flex items-center gap-2 mx-auto">
                <FileSpreadsheet className="w-4 h-4" />
                Ingest Synthetic Dataset
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
                  <th className="p-4">Case Identifier</th>
                  <th className="p-4">Target Invoice</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Composite Score</th>
                  <th className="p-4">Lifecycle State</th>
                  <th className="p-4 text-right">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.case_id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-foreground font-mono">{c.case_id}</div>
                      <div className="text-xs text-muted-foreground">{c.case_number}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-xs font-semibold text-foreground">
                        {c.transaction_id}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Target Transaction</div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={
                          c.priority.toLowerCase() === 'high'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : c.priority.toLowerCase() === 'medium'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-info/10 text-info border-info/20'
                        }
                      >
                        {c.priority} Priority
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground font-mono">
                          {c.total_score}
                        </span>
                        <span className="text-xs text-muted-foreground">/ 100</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={
                          c.status === 'Closed'
                            ? 'bg-success/10 text-success border-success/20'
                            : c.status === 'Pending Verification'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-primary/10 text-primary border-primary/20'
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/cases/${c.case_id}`}>
                        <Button size="sm" className="flex items-center gap-1.5 ml-auto">
                          Investigate
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
