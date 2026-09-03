'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, Search, ChevronLeft, ChevronRight, History } from 'lucide-react'

interface AuditEvent {
  id: string
  timestamp: string
  user: string
  action: string
  resource: string
  status: 'success' | 'failure'
  details: string
}

const auditEvents: AuditEvent[] = [
  {
    id: '1',
    timestamp: '2026-08-28 14:32:18',
    user: 'sarah@company.com',
    action: 'Access',
    resource: 'Financial Reports',
    status: 'success',
    details: 'View permission granted',
  },
  {
    id: '2',
    timestamp: '2026-08-28 14:28:45',
    user: 'john@company.com',
    action: 'Export',
    resource: 'Compliance Data',
    status: 'success',
    details: 'CSV export completed',
  },
  {
    id: '3',
    timestamp: '2026-08-28 14:15:22',
    user: 'maria@company.com',
    action: 'Modify',
    resource: 'Risk Scores',
    status: 'success',
    details: 'Updated supplier risk assessment',
  },
  {
    id: '4',
    timestamp: '2026-08-28 14:02:10',
    user: 'david@company.com',
    action: 'Access',
    resource: 'Zero-Trust Logs',
    status: 'failure',
    details: 'Insufficient permissions',
  },
  {
    id: '5',
    timestamp: '2026-08-28 13:45:33',
    user: 'alex@company.com',
    action: 'Report',
    resource: 'Compliance Summary',
    status: 'success',
    details: 'Generated monthly report',
  },
  {
    id: '6',
    timestamp: '2026-08-28 13:30:15',
    user: 'sarah@company.com',
    action: 'Approve',
    resource: 'Audit Finding',
    status: 'success',
    details: 'Marked as resolved',
  },
]

export function AuditTrail() {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  const filtered = auditEvents.filter((event) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      event.user.toLowerCase().includes(q) ||
      event.action.toLowerCase().includes(q) ||
      event.resource.toLowerCase().includes(q) ||
      event.details.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, filtered.length)

  return (
    <Card className="p-6 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Global Audit Trail</h2>
            <p className="text-[11px] text-muted-foreground">Immutable compliance and system operation telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search user, action, resource..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8 h-8 text-xs bg-muted/20 border-0 rounded-xl"
            />
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border-0 font-semibold shrink-0">
            {filtered.length} Events
          </span>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[380px] overflow-y-auto scrollbar-thin">
        <table className="w-full text-xs text-left min-w-[640px]">
          <thead className="bg-muted/15 border-b border-border/20 font-mono font-semibold uppercase text-[10px] text-muted-foreground/70 sticky top-0 z-10 backdrop-blur-xs">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">User Entity</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Resource Target</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {paginated.map((event) => (
              <tr key={event.id} className="hover:bg-muted/15 transition-colors">
                <td className="py-2.5 px-3 font-mono">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3 text-muted-foreground/60" />
                    <span>{event.timestamp}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-foreground font-medium">{event.user}</td>
                <td className="py-2.5 px-3">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {event.action}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 text-foreground font-mono text-[11px]">{event.resource}</td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                      event.status === 'success'
                        ? 'bg-success/15 text-success border-success/30'
                        : 'bg-destructive/15 text-destructive border-destructive/30'
                    }`}
                  >
                    {event.status === 'success' ? '✓ SUCCESS' : '✕ FAILED'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground text-[11px]">{event.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
        <span className="text-muted-foreground text-[11px]">
          Showing <strong className="text-foreground font-mono">{startIndex}</strong>–
          <strong className="text-foreground font-mono">{endIndex}</strong> of{' '}
          <strong className="text-foreground font-mono">{filtered.length}</strong> events
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-7 px-2 text-xs gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </Button>
          <span className="px-2 py-0.5 rounded bg-muted/20 border border-border font-mono text-[10px] text-muted-foreground">
            {currentPage} / {totalPages}
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
  )
}
