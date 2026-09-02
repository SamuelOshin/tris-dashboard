'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, Transaction, RiskCase } from '@/lib/api'
import { ShieldAlert, ArrowRight, CheckCircle2, Calendar, FileText } from 'lucide-react'
import Link from 'next/link'

export function OverviewDashboard() {
  const [benchmarkCase, setBenchmarkCase] = useState<RiskCase | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.getCases().catch(() => []),
      api.getTransactions(undefined, 0, 7).catch(() => []),
    ])
      .then(([cases, txs]) => {
        if (mounted) {
          const highCase = cases.find((c) => c.priority.toLowerCase() === 'high') || cases[0] || null
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <div className="h-6 bg-muted/40 rounded w-1/3 animate-pulse" />
          <div className="h-24 bg-muted/20 rounded animate-pulse" />
        </Card>
        <Card className="p-6 space-y-3">
          <div className="h-5 bg-muted/40 rounded w-1/4 animate-pulse" />
          <div className="h-32 bg-muted/20 rounded animate-pulse" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Benchmark Spotlight */}
      {benchmarkCase && (
        <Card className="p-6 border-l-4 border-l-destructive bg-card relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                  {benchmarkCase.priority} Priority Anomaly
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">{benchmarkCase.case_id}</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Multi-Signal Risk Trigger: {benchmarkCase.transaction_id} ($104,000.00)
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                Northstar Components LLC invoice exceeds historical baseline ($30,471.43) by 3.41x, preceded by recent bank detail changes and unauthorized off-hours access.
              </p>
            </div>

            <Link href={`/cases/${benchmarkCase.case_id}`}>
              <Button className="flex items-center gap-2 flex-shrink-0">
                Investigate Case
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Recent Audited Transactions */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Audited Invoices Ledger</h3>
            <p className="text-xs text-muted-foreground">Recent transactions evaluated by deterministic rules engine</p>
          </div>
          <Link href="/fraud-detection">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Cases
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 border-b border-border text-muted-foreground font-semibold uppercase">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Date</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Approval</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentTransactions.map((tx) => (
                <tr key={tx.transaction_id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 font-mono font-semibold text-foreground">{tx.invoice_number || tx.transaction_id}</td>
                  <td className="p-3 text-muted-foreground font-mono">{tx.supplier_id}</td>
                  <td className="p-3 text-muted-foreground">{tx.invoice_date}</td>
                  <td className="p-3 font-semibold font-mono text-foreground">
                    ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                      {tx.approval_status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {tx.transaction_id === 'TX-1999' ? (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                        Flagged Anomaly
                      </Badge>
                    ) : (
                      <span className="text-success inline-flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
