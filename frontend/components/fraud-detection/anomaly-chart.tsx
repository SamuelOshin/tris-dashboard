'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { api, Transaction } from '@/lib/api'

export function AnomalyChart() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.getTransactions()
      .then((data) => {
        if (mounted) {
          setTransactions(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <div className="h-5 bg-muted/40 rounded w-1/3 animate-pulse" />
        <div className="h-[300px] bg-muted/20 rounded animate-pulse" />
      </Card>
    )
  }

  // Map transactions to chart coordinates
  const plotData = transactions.map((t, idx) => {
    const isTargetAnomaly = t.transaction_id === 'TX-1999' || t.amount >= 80000
    const isElevated = t.amount >= 50000 && t.amount < 80000
    return {
      tx_id: t.transaction_id,
      supplier_id: t.supplier_id,
      amount: t.amount,
      index: idx + 1,
      isTargetAnomaly,
      color: isTargetAnomaly ? '#ef4444' : isElevated ? '#f59e0b' : '#10b981',
      status: isTargetAnomaly ? 'Flagged Anomaly' : 'Baseline Verified',
    }
  })

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Transaction Amount Anomaly Distribution</h2>
          <p className="text-xs text-muted-foreground">
            Scatter plot of {transactions.length} audited invoices across supplier baselines
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis
            type="number"
            dataKey="amount"
            name="Invoice Amount"
            stroke="var(--muted-foreground)"
            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="index"
            name="Invoice Sequence"
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value, name, item) => {
              if (name === 'Invoice Amount') return [`$${Number(value).toLocaleString()}`, 'Amount']
              if (name === 'Invoice Sequence') return [`${item.payload.tx_id} (${item.payload.supplier_id})`, 'Transaction']
              return [value, name]
            }}
          />
          <Scatter name="Transactions" data={plotData}>
            {plotData.map((entry) => (
              <Cell key={entry.tx_id} fill={entry.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-muted-foreground">Historical Baseline Range ($28k - $35k)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="text-foreground font-semibold">Flagged Outlier (TX-1999: $104,000.00)</span>
        </div>
      </div>
    </Card>
  )
}
