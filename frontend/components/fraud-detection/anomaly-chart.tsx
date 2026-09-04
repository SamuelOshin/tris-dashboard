'use client'

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
  ReferenceArea,
  ReferenceLine,
} from 'recharts'
import { api, Transaction, formatCurrency } from '@/lib/api'
import { Activity, AlertTriangle } from 'lucide-react'
import { useFetchData } from '@/hooks/use-fetch-data'
import { ErrorCard } from '@/components/ui/error-card'

export function AnomalyChart() {
  const { data: transactions, loading, error, refetch } = useFetchData<Transaction[]>(() =>
    api.getTransactions(),
  )

  if (error) {
    return (
      <Card className="p-6 bg-card border-border">
        <ErrorCard title="Failed to Load Anomaly Distribution" message={error} onRetry={refetch} />
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="p-6 space-y-4 bg-card border-border">
        <div className="h-5 bg-muted/40 rounded w-1/3 animate-pulse" />
        <div className="h-[280px] bg-muted/20 rounded animate-pulse" />
      </Card>
    )
  }

  // Map transactions to chart coordinates
  const txs = transactions ?? []
  const plotData = txs.map((t, idx) => {
    const isTargetAnomaly = t.transaction_id === 'TX-1999' || t.amount >= 80000
    const isElevated = t.amount >= 50000 && t.amount < 80000
    return {
      tx_id: t.transaction_id,
      supplier_id: t.supplier_id,
      amount: t.amount,
      index: idx + 1,
      isTargetAnomaly,
      color: isTargetAnomaly ? '#f43f5e' : isElevated ? '#f59e0b' : '#10b981',
      status: isTargetAnomaly ? 'Flagged Anomaly' : isElevated ? 'Elevated Monitoring' : 'Baseline Verified',
    }
  })

  return (
    <Card className="p-6 bg-card border-border space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Transaction Amount Anomaly Distribution
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scatter distribution of {txs.length} audited transactions against statistical bounds
          </p>
        </div>
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground">
          {txs.length} Invoices
        </span>
      </div>

      <div className="pt-2">
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 15, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              type="number"
              dataKey="amount"
              name="Invoice Amount"
              stroke="var(--muted-foreground)"
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="index"
              name="Invoice Sequence"
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--foreground)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
              itemStyle={{
                color: 'var(--foreground)',
              }}
              labelStyle={{
                color: 'var(--foreground)',
              }}
              formatter={(value, name, item) => {
                if (name === 'Invoice Amount') return [formatCurrency(Number(value)), 'Amount']
                if (name === 'Invoice Sequence') return [`${item.payload.tx_id} (${item.payload.supplier_id})`, 'Transaction']
                return [value, name]
              }}
            />
            {/* Reference Line for 2.0x threshold */}
            <ReferenceLine x={60942} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: '2.0x Baseline ($60.9k)', fill: 'var(--warning)', fontSize: 10, position: 'top' }} />
            <Scatter name="Transactions" data={plotData}>
              {plotData.map((entry) => (
                <Cell key={entry.tx_id} fill={entry.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-muted-foreground text-[11px]">Baseline Range ($28k – $35k)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-warning" />
          <span className="text-muted-foreground text-[11px]">Elevated ($50k – $80k)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-foreground font-semibold text-[11px]">Target Outlier (TX-1999: $104,000.00)</span>
        </div>
      </div>
    </Card>
  )
}
