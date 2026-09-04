'use client'

import { useState, useEffect, useMemo } from 'react'
import { api, AccessEvent, AccessEventStats } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Activity,
  AlertTriangle,
  Clock,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Server,
  UserCheck,
  Building2,
  ExternalLink,
  ShieldAlert,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export function ZeroTrustDashboard() {
  const [events, setEvents] = useState<AccessEvent[]>([])
  const [stats, setStats] = useState<AccessEventStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [systemFilter, setSystemFilter] = useState<string>('ALL')
  const [offHoursOnly, setOffHoursOnly] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AccessEvent | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [eventsData, statsData] = await Promise.all([
        api.getAccessEvents({ limit: 100 }),
        api.getAccessEventStats(),
      ])
      setEvents(eventsData || [])
      setStats(statsData || null)
    } catch (err: any) {
      toast.error('Failed to load access telemetry: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (offHoursOnly && !e.flagged) return false
      if (systemFilter !== 'ALL' && e.system !== systemFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesUser = e.user_id.toLowerCase().includes(q)
        const matchesSupplier = (e.supplier_id || '').toLowerCase().includes(q)
        const matchesAction = e.action.toLowerCase().includes(q)
        const matchesResource = e.resource.toLowerCase().includes(q)
        const matchesId = e.event_id.toLowerCase().includes(q)
        if (!matchesUser && !matchesSupplier && !matchesAction && !matchesResource && !matchesId) {
          return false
        }
      }
      return true
    })
  }, [events, offHoursOnly, systemFilter, searchQuery])

  // Unique systems for filter
  const systems = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => {
      if (e.system) set.add(e.system)
    })
    return Array.from(set)
  }, [events])

  // Hourly distribution for 24h timeline
  const hourlyCounts = useMemo(() => {
    const counts: { hour: number; total: number; offHours: number }[] = Array.from(
      { length: 24 },
      (_, i) => ({ hour: i, total: 0, offHours: 0 })
    )
    events.forEach((e) => {
      try {
        const d = new Date(e.event_time)
        const h = d.getHours()
        if (h >= 0 && h < 24) {
          counts[h].total += 1
          if (e.flagged) {
            counts[h].offHours += 1
          }
        }
      } catch {
        // ignore date parse issue
      }
    })
    return counts
  }, [events])

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                Zero-Trust Access Telemetry
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Surveillance and behavioral anomaly logging for Rule R-004 (Off-Hours Access)
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-9 px-3.5 rounded-xl border-border/60 hover:bg-muted/40 text-xs font-medium gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
          <Link href="/fraud-detection">
            <Button
              size="sm"
              className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs gap-1.5 shadow-sm"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              View Triggered Cases
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-border/80 shadow-sm rounded-2xl bg-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Access Events</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {stats ? stats.total_events.toLocaleString() : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
            <span>Ingested from relational ERP & IAM logs</span>
          </p>
        </Card>

        <Card className="p-5 border-border/80 shadow-sm rounded-2xl bg-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Off-Hours Flags (R-004)</p>
              <p className="text-2xl font-bold text-destructive tracking-tight">
                {stats ? stats.off_hours_events.toLocaleString() : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
            <span className="text-destructive font-medium">Outside 06:00–20:00 window</span>
          </p>
        </Card>

        <Card className="p-5 border-border/80 shadow-sm rounded-2xl bg-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Monitored Identities</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {stats ? stats.unique_users.toLocaleString() : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            <span>Active operators and finance actors</span>
          </p>
        </Card>

        <Card className="p-5 border-border/80 shadow-sm rounded-2xl bg-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Connected Systems</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {stats ? stats.unique_systems.toLocaleString() : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            <span>ERP, Vendor Portal, & IAM services</span>
          </p>
        </Card>
      </div>

      {/* 24-Hour Timeline Distribution Card */}
      <Card className="p-5 border-border/80 shadow-sm rounded-2xl bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">24-Hour Access Pattern Surveillance</h3>
            <p className="text-xs text-muted-foreground">
              Red highlights represent off-hours activity outside standard authorized business hours (20:00 – 06:00).
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground text-[11px]">Business Hours (06:00-20:00)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive"></span>
              <span className="text-muted-foreground text-[11px]">Off-Hours Trigger (R-004)</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Representation */}
        <div className="grid grid-cols-24 gap-1 items-end h-28 pt-4 pb-2 border-b border-border/60">
          {hourlyCounts.map((item) => {
            const isOffHour = item.hour < 6 || item.hour >= 20
            const maxVal = Math.max(...hourlyCounts.map((c) => c.total), 1)
            const heightPct = Math.max((item.total / maxVal) * 100, item.total > 0 ? 15 : 4)

            return (
              <div
                key={item.hour}
                className="flex flex-col items-center gap-1 group relative h-full justify-end"
              >
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-popover text-popover-foreground text-[10px] font-mono px-1.5 py-0.5 rounded shadow border border-border pointer-events-none whitespace-nowrap z-10">
                  {String(item.hour).padStart(2, '0')}:00 · {item.total} events ({item.offHours} off-hours)
                </div>
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-t transition-all ${
                    isOffHour
                      ? item.total > 0
                        ? 'bg-destructive/80 hover:bg-destructive'
                        : 'bg-destructive/20'
                      : item.total > 0
                      ? 'bg-emerald-500/80 hover:bg-emerald-500'
                      : 'bg-muted/40'
                  }`}
                />
                <span className="text-[9px] font-mono text-muted-foreground/70">
                  {item.hour % 4 === 0 ? String(item.hour).padStart(2, '0') : ''}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl p-4 shadow-sm">
        <div className="flex-1 relative min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by User ID, Supplier, Action, or Event ID..."
            className="pl-9 h-9.5 rounded-xl border-border/60 bg-background text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* System Dropdown */}
          <div className="flex items-center gap-1.5 bg-muted/30 border border-border/60 rounded-xl px-2.5 py-1 text-xs">
            <Server className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Systems</option>
              {systems.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Off-Hours Toggle Button */}
          <Button
            variant={offHoursOnly ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setOffHoursOnly(!offHoursOnly)}
            className={`h-9 px-3 rounded-xl text-xs font-medium gap-1.5 transition-all ${
              offHoursOnly ? '' : 'border-border/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {offHoursOnly ? 'Showing Off-Hours Only' : 'Filter Off-Hours Only'}
          </Button>

          {(searchQuery || systemFilter !== 'ALL' || offHoursOnly) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSystemFilter('ALL')
                setOffHoursOnly(false)
              }}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Telemetry Log Table */}
      <Card className="border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Access Telemetry Ledger</h3>
            <Badge variant="secondary" className="text-[11px] font-mono">
              {filteredEvents.length} events
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Click row to inspect full telemetry diagnostics
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span>Loading relational access telemetry from database...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs">
            No access events matched the specified search and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">System</th>
                  <th className="py-3 px-4">Action & Resource</th>
                  <th className="py-3 px-4">Supplier Target</th>
                  <th className="py-3 px-4">Surveillance Flag</th>
                  <th className="py-3 px-4">Location Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEvents.map((e) => {
                  const eventDate = new Date(e.event_time)
                  const formattedDate = !isNaN(eventDate.getTime())
                    ? eventDate.toISOString().replace('T', ' ').substring(0, 19)
                    : e.event_time

                  return (
                    <tr
                      key={e.event_id}
                      onClick={() => setSelectedEvent(e)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {e.event_id}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary/70"></span>
                          <span>{e.user_id}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {e.system}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground">{e.action}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {e.resource}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {e.supplier_id ? (
                          <Link
                            href={`/suppliers`}
                            onClick={(ev) => ev.stopPropagation()}
                            className="text-primary hover:underline font-mono font-medium flex items-center gap-1"
                          >
                            <Building2 className="w-3 h-3" />
                            {e.supplier_id}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {e.flagged ? (
                          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-medium gap-1 flex items-center w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            Off-Hours (R-004)
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-medium w-fit">
                            Authorized Hours
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {e.location_context || 'Standard Network'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Event Details Inspection Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="max-w-xl w-full border-border/80 shadow-2xl rounded-2xl overflow-hidden bg-card">
            <div className="p-5 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Access Telemetry Event: {selectedEvent.event_id}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Deterministic security and access audit record
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEvent(null)}
                className="h-8 w-8 p-0 rounded-lg"
              >
                ✕
              </Button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                  <p className="text-muted-foreground text-[11px]">User Identity</p>
                  <p className="font-bold text-foreground mt-0.5 font-mono">{selectedEvent.user_id}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                  <p className="text-muted-foreground text-[11px]">System & Origin</p>
                  <p className="font-bold text-foreground mt-0.5 font-mono">
                    {selectedEvent.system} ({selectedEvent.location_context || 'Office Network'})
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                  <p className="text-muted-foreground text-[11px]">Timestamp</p>
                  <p className="font-bold text-foreground mt-0.5 font-mono">
                    {selectedEvent.event_time}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                  <p className="text-muted-foreground text-[11px]">Surveillance Status</p>
                  <div className="mt-1">
                    {selectedEvent.flagged ? (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                        ⚠️ Rule R-004 Trigger (Off-Hours)
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                        Authorized Business Hours
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <p className="text-muted-foreground text-[11px]">Action & Resource Path</p>
                <p className="font-semibold text-foreground">
                  {selectedEvent.action} → {selectedEvent.resource}
                </p>
              </div>

              {selectedEvent.supplier_id && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-[11px]">Associated Supplier Target</p>
                    <p className="font-bold text-foreground font-mono mt-0.5">
                      {selectedEvent.supplier_id}
                    </p>
                  </div>
                  <Link href={`/suppliers`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <Building2 className="w-3 h-3" />
                      View Supplier
                    </Button>
                  </Link>
                </div>
              )}

              {selectedEvent.notes && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                  <p className="text-muted-foreground text-[11px]">Diagnostic / Operational Notes</p>
                  <p className="text-foreground leading-relaxed">{selectedEvent.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/20 border-t border-border/60 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEvent(null)}
                className="h-8 px-4 rounded-xl text-xs"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
