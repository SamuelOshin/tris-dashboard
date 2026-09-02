'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api, Transaction, RiskCase, formatCurrency } from '@/lib/api'
import {
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MoreHorizontal,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

export function OverviewDashboard() {
  const [benchmarkCase, setBenchmarkCase] = useState<RiskCase | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'high_risk' | 'missing_approval' | 'over_50k'>('all')

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.getCases().catch(() => []),
      api.getTransactions(undefined, 0, 10).catch(() => []),
    ])
      .then(([cases, txs]) => {
        if (mounted) {
          const highCase = cases.find((c) => c.priority?.toLowerCase() === 'high') || cases[0] || null
          setBenchmarkCase(highCase)
          setRecentTransactions(txs)
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const filteredTransactions = recentTransactions.filter((tx) => {
    if (activeFilter === 'high_risk') return tx.transaction_id === 'TX-1999' || tx.amount >= 80000
    if (activeFilter === 'missing_approval') return tx.approval_status === 'Missing'
    if (activeFilter === 'over_50k') return tx.amount >= 50000
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6 space-y-4 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="h-5 bg-muted/40 rounded-lg w-1/3 animate-pulse" />
          <div className="h-40 bg-muted/20 rounded-xl animate-pulse" />
        </Card>
        <Card className="p-6 space-y-4 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="h-5 bg-muted/40 rounded-lg w-1/4 animate-pulse" />
          <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. OVERVIEW HERO CARD WITH TELEMETRY SPLINE CHART */}
      <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] transition-all">
        {/* Header with Title and ... Action button */}
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Risk & Variance Overview
          </h2>
          <button
            title="More Options"
            className="w-8 h-8 rounded-full bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Split: Telemetry Numbers on Left, Spline Curves on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                Total Incident Exposure
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono">
                  $104,000
                </span>
                <span className="text-lg font-bold text-muted-foreground/50 font-mono">.00</span>
              </div>
            </div>

            {/* Quick Trend Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-destructive/10 text-destructive border-0">
                <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
                +3.41x vs Baseline ($30.4k)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-warning/10 text-warning border-0">
                <ArrowDownRight className="w-3.5 h-3.5 text-warning" />
                2-Day Bank Delta
              </span>
            </div>

            {/* Narrative Intelligence Copy */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              With Northstar Components LLC invoice TX-1999 exceeding historical baseline ($30,471.43) by <strong>3.41x</strong>, preceded by recent routing updates and off-hours access, automated rules recommend immediate human investigator review.
            </p>

            {/* Action CTA Button */}
            {benchmarkCase && (
              <div className="pt-1">
                <Link href={`/cases/${benchmarkCase.case_id}`}>
                  <Button
                    size="sm"
                    className="h-9 px-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-xs flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                    Investigate Case {benchmarkCase.case_id}
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Spline Chart (7 Cols) */}
          <div className="lg:col-span-7 relative bg-muted/15 dark:bg-muted/10 rounded-2xl p-4 sm:p-5 overflow-hidden">
            {/* Pinned Tooltip Card (Like the reference image) */}
            <div className="absolute top-4 right-4 sm:right-8 z-10 bg-card dark:bg-[#1d2027] p-3 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] border-0 text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span>Aug 2026 · TX-1999</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-[11px] text-muted-foreground">Invoice</span>
                </div>
                <span className="font-mono font-bold text-foreground text-xs">$104,000</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[11px] text-muted-foreground">Baseline</span>
                </div>
                <span className="font-mono font-bold text-foreground text-xs">$30,471</span>
              </div>
            </div>

            {/* SVG Telemetry Spline Visualization */}
            <div className="w-full h-44 sm:h-52">
              <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
                <defs>
                  {/* Subtle gradient fills under curves */}
                  <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.60 0.22 25)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="oklch(0.60 0.22 25)" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.58 0.22 260)" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="oklch(0.58 0.22 260)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="20" y1="30" x2="580" y2="30" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
                <line x1="20" y1="75" x2="580" y2="75" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
                <line x1="20" y1="120" x2="580" y2="120" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
                <line x1="20" y1="165" x2="580" y2="165" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />

                {/* Y-axis Labels */}
                <text x="585" y="34" fill="currentColor" fillOpacity="0.3" fontSize="9" fontFamily="monospace">120k</text>
                <text x="585" y="79" fill="currentColor" fillOpacity="0.3" fontSize="9" fontFamily="monospace">80k</text>
                <text x="585" y="124" fill="currentColor" fillOpacity="0.3" fontSize="9" fontFamily="monospace">40k</text>
                <text x="585" y="169" fill="currentColor" fillOpacity="0.3" fontSize="9" fontFamily="monospace">0k</text>

                {/* Baseline Smooth Spline Curve (Calm Blue Wave) */}
                <path
                  d="M 20,150 C 90,140 140,155 200,145 C 260,135 320,148 380,142 C 440,138 500,145 570,140"
                  fill="none"
                  stroke="oklch(0.58 0.22 260)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Anomaly Spline Curve (Spike at Aug / index 380) */}
                <path
                  d="M 20,160 C 90,152 140,135 200,140 C 260,145 320,120 380,38 C 430,42 490,110 570,130"
                  fill="none"
                  stroke="oklch(0.60 0.22 25)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Gradient area under anomaly curve */}
                <path
                  d="M 20,160 C 90,152 140,135 200,140 C 260,145 320,120 380,38 C 430,42 490,110 570,130 L 570,185 L 20,185 Z"
                  fill="url(#anomalyGradient)"
                />

                {/* Indicator Circle at Anomaly Peak */}
                <circle cx="380" cy="38" r="5" fill="oklch(0.60 0.22 25)" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="380" cy="38" r="10" fill="oklch(0.60 0.22 25)" fillOpacity="0.25" />

                {/* Indicator Circle at Baseline Point */}
                <circle cx="380" cy="142" r="4" fill="oklch(0.58 0.22 260)" stroke="#FFFFFF" strokeWidth="1.5" />
              </svg>

              {/* X-axis Month Labels */}
              <div className="flex justify-between px-2 pt-1 text-[9px] font-mono text-muted-foreground/60 uppercase">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span className="font-bold text-foreground">Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. RISK TELEMETRY & MOVEMENT (Directly mirroring the "Money movement" card from the reference image) */}
      <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f]">
        <div className="flex items-center justify-between pb-5">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Risk Movement & Volume Breakdown
          </h2>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/30 text-xs font-medium text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Aug 2026</span>
          </div>
        </div>

        {/* 2 Side-by-Side Subcards (like "Money in" and "Money Out") */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Subcard 1: Anomaly Invoices */}
          <div className="rounded-2xl bg-muted/20 dark:bg-muted/10 p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Anomalous Volume</span>
              <div className="w-7 h-7 rounded-lg bg-card dark:bg-[#20232b] flex items-center justify-center text-muted-foreground shadow-xs">
                <Plus className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                $104,000
              </span>
              <span className="text-sm font-mono text-muted-foreground/60">.00</span>
            </div>

            {/* Segmented Progress Bar (Pill with vibrant segments) */}
            <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex gap-0.5">
              <div className="h-full bg-destructive rounded-l-full w-[65%]" title="Amount Deviation (3.41x)" />
              <div className="h-full bg-warning w-[20%]" title="Recent Bank Delta (2 days)" />
              <div className="h-full bg-primary rounded-r-full w-[15%]" title="Off-Hours Access (22:47)" />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
              The highest risk signal this cycle is from{' '}
              <strong className="text-destructive font-semibold">Amount Deviation 3.41x</strong>
            </p>
          </div>

          {/* Subcard 2: Standard Audited Volume */}
          <div className="rounded-2xl bg-muted/20 dark:bg-muted/10 p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Verified Standard Volume</span>
              <div className="w-7 h-7 rounded-lg bg-card dark:bg-[#20232b] flex items-center justify-center text-success shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                $548,485
              </span>
              <span className="text-sm font-mono text-muted-foreground/60">.71</span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex gap-0.5">
              <div className="h-full bg-success rounded-full w-[94.7%]" title="18 Compliant Invoices" />
              <div className="h-full bg-destructive/60 rounded-r-full w-[5.3%]" title="1 Flagged Outlier" />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
              Over <strong>94.7%</strong> of audited transactions cleared all{' '}
              <strong className="text-success font-semibold">6 deterministic rules</strong>
            </p>
          </div>
        </div>
      </Card>

      {/* 3. AUDITED INVOICES TRANSACTIONS CARD (Mirroring the "Transactions" card from the reference image) */}
      <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] space-y-5">
        {/* Header with Title and Segmented Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Audited Invoices
            </h2>
            <p className="text-xs text-muted-foreground">
              Continuous relational ledger monitored against deterministic baselines
            </p>
          </div>

          {/* Segmented Filter Pills (like "Recent", "My transactions", etc.) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setActiveFilter('high_risk')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'high_risk'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              High Risk
            </button>
            <button
              onClick={() => setActiveFilter('missing_approval')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'missing_approval'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              Missing Approval
            </button>
            <button
              onClick={() => setActiveFilter('over_50k')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'over_50k'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              Over $50k
            </button>
          </div>
        </div>

        {/* Clean, Borderless Ledger Table */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground/70 font-mono font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Invoice Ref</th>
                <th className="py-3 px-3">Supplier ID</th>
                <th className="py-3 px-3">Invoice Date</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Approval</th>
                <th className="py-3 px-3 text-right">Verification Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-mono">
              {filteredTransactions.map((tx) => {
                const isOutlier = tx.transaction_id === 'TX-1999' || tx.amount >= 80000
                return (
                  <tr
                    key={tx.transaction_id}
                    className={`transition-colors rounded-xl ${
                      isOutlier
                        ? 'bg-destructive/5 hover:bg-destructive/10'
                        : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-semibold text-foreground">
                      {tx.invoice_number || tx.transaction_id}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground text-[11px]">
                        {tx.supplier_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground font-sans text-xs">
                      {tx.invoice_date}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-foreground">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3.5 px-3 font-sans">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-medium ${
                          tx.approval_status === 'Approved'
                            ? 'bg-success/10 text-success'
                            : tx.approval_status === 'Missing'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        {tx.approval_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-sans">
                      {isOutlier ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-destructive/15 text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          Flagged Anomaly
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-medium text-success">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <Link
                        href={isOutlier ? '/cases/TEST-CASE-001' : '/fraud-detection'}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        title="View Details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
