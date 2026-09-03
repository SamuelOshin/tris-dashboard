'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, RiskCase, getCompositeScore } from '@/lib/api'
import {
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  Search,
  MoreHorizontal,
  ChevronRight,
  Plus,
} from 'lucide-react'
import Link from 'next/link'

export function AlertsPanel() {
  const [cases, setCases] = useState<RiskCase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let mounted = true
    api.getCases()
      .then((data) => {
        if (mounted) setCases(data)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const filteredCases = cases.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.case_id.toLowerCase().includes(q) ||
      c.transaction_id.toLowerCase().includes(q) ||
      (c.supplier_id && c.supplier_id.toLowerCase().includes(q)) ||
      c.priority.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <Card className="p-6 min-h-[460px] lg:h-[640px] space-y-4 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="h-5 bg-muted/40 rounded-lg w-1/2 animate-pulse" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/20 rounded-xl animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5 sm:p-7 min-h-[460px] lg:h-[640px] flex flex-col justify-between bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] overflow-hidden">
      {/* Sticky Header with Title, ... More Button, and Search */}
      <div className="pb-3.5 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">Active Alerts</h2>
            <p className="text-[11px] text-muted-foreground">Continuous surveillance pipeline</p>
          </div>
          <button
            title="Alert Settings"
            className="w-8 h-8 rounded-full bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Soft Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search alerts by ref, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8.5 h-8 text-xs bg-muted/20 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/40 placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Scrollable Body with Borderless Floating Item Cards */}
      <div className="flex-1 overflow-y-auto pr-1 my-2 space-y-2.5">
        {filteredCases.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <CheckCircle className="w-8 h-8 text-success mx-auto opacity-80" />
            <p className="text-xs font-semibold text-foreground">
              {searchQuery ? 'No Matching Alerts' : 'Zero Active Anomalies'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {searchQuery ? 'Try clearing your search query.' : 'All risk cases are verified and resolved.'}
            </p>
          </div>
        ) : (
          filteredCases.map((c) => {
            const score = getCompositeScore(c)
            const isHigh = c.priority?.toLowerCase() === 'high' || score >= 70

            return (
              <div
                key={c.case_id}
                className={`p-3.5 rounded-xl transition-all ${
                  isHigh
                    ? 'bg-destructive/10 hover:bg-destructive/15'
                    : 'bg-muted/25 dark:bg-muted/10 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground truncate">
                        {c.case_id}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md uppercase ${
                          isHigh
                            ? 'bg-destructive/20 text-destructive'
                            : 'bg-warning/20 text-warning'
                        }`}
                      >
                        {c.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Target: <span className="font-mono font-semibold text-foreground">{c.transaction_id}</span>
                    </p>
                  </div>

                  {/* Composite Score Pill */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                        score >= 70
                          ? 'bg-destructive/15 text-destructive'
                          : score >= 30
                          ? 'bg-warning/15 text-warning'
                          : 'bg-success/15 text-success'
                      }`}
                    >
                      {score} / 100
                    </span>
                    <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
                      {c.status}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/30 text-[11px]">
                  <span className="text-muted-foreground text-[10px] flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-muted-foreground/60" />
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Active'}
                  </span>
                  <Link
                    href={`/cases/${c.case_id}`}
                    className="text-primary hover:text-primary/80 font-medium flex items-center gap-1 text-[11px] transition-colors"
                  >
                    Investigate <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Bottom Full-Width Action Button (Just like "+ Create account" in the reference image!) */}
      <div className="pt-3 border-t border-border/40 shrink-0 space-y-2">
        <Link href="/fraud-detection" className="block">
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl border-0 bg-muted/30 hover:bg-muted/60 text-xs font-semibold text-foreground flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Review All Risk Inquiries
          </Button>
        </Link>
      </div>
    </Card>
  )
}
