'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, Supplier } from '@/lib/api'
import { ShieldAlert } from 'lucide-react'

export function RiskMatrix() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api
      .getSuppliers()
      .then((data) => {
        if (mounted) {
          setSuppliers(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <Card className="p-6 space-y-4 bg-card border-border">
        <div className="h-5 bg-muted/40 rounded w-1/3 animate-pulse" />
        <div className="h-[220px] bg-muted/20 rounded animate-pulse" />
      </Card>
    )
  }

  // Count risk tiers
  const tierCounts: Record<string, number> = {
    Low: 0,
    Medium: 0,
    High: 0,
  }

  suppliers.forEach((s) => {
    const tier = s.risk_tier ? s.risk_tier.charAt(0).toUpperCase() + s.risk_tier.slice(1).toLowerCase() : 'Medium'
    tierCounts[tier] = (tierCounts[tier] || 0) + 1
  })

  const total = suppliers.length || 1
  const riskData = [
    { tier: 'Low Risk', count: tierCounts['Low'] || 0, fill: '#10b981', percent: Math.round(((tierCounts['Low'] || 0) / total) * 100) },
    { tier: 'Medium Risk', count: tierCounts['Medium'] || 0, fill: '#f59e0b', percent: Math.round(((tierCounts['Medium'] || 0) / total) * 100) },
    { tier: 'High Risk', count: tierCounts['High'] || 0, fill: '#f43f5e', percent: Math.round(((tierCounts['High'] || 0) / total) * 100) },
  ]

  return (
    <Card className="p-6 bg-card border-border flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-warning" />
              Risk Tier Stratification
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vendor risk distribution across all active suppliers
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground">
            {suppliers.length} Profiles
          </span>
        </div>

        <div className="pt-2">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={riskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="tier"
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                allowDecimals={false}
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                formatter={(val) => [`${val} suppliers`, 'Count']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {riskData.map((entry) => (
                  <Cell key={entry.tier} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tier summary pills */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs">
          {riskData.map((tier) => (
            <div key={tier.tier} className="p-2 rounded-lg bg-muted/10 border border-border/50 text-center space-y-0.5">
              <span className="text-[10px] font-mono text-muted-foreground block">{tier.tier}</span>
              <p className="font-bold text-foreground font-mono text-sm">{tier.count}</p>
              <span className="text-[10px] font-mono text-muted-foreground">({tier.percent}%)</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
