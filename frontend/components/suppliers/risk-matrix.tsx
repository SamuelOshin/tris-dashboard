'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api, Supplier } from '@/lib/api'

export function RiskMatrix() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.getSuppliers().then((data) => {
      if (mounted) {
        setSuppliers(data)
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <Card className="p-6 space-y-4">
        <div className="h-5 bg-muted/40 rounded w-1/3 animate-pulse" />
        <div className="h-[260px] bg-muted/20 rounded animate-pulse" />
      </Card>
    )
  }

  // Count risk tiers
  const tierCounts: Record<string, number> = {
    'Low': 0,
    'Medium': 0,
    'High': 0,
  }

  suppliers.forEach((s) => {
    const tier = s.risk_tier ? (s.risk_tier.charAt(0).toUpperCase() + s.risk_tier.slice(1).toLowerCase()) : 'Medium'
    tierCounts[tier] = (tierCounts[tier] || 0) + 1
  })

  const riskData = [
    { tier: 'Low Risk', count: tierCounts['Low'] || 0, fill: '#10b981' },
    { tier: 'Medium Risk', count: tierCounts['Medium'] || 0, fill: '#f59e0b' },
    { tier: 'High Risk', count: tierCounts['High'] || 0, fill: '#ef4444' },
  ]

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">Risk Tier Distribution</h2>
      <p className="text-xs text-muted-foreground mb-4">Risk stratification across active supplier profiles</p>
      
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={riskData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis dataKey="tier" stroke="var(--muted-foreground)" textAnchor="middle" tick={{ fontSize: 12 }} />
          <YAxis stroke="var(--muted-foreground)" allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(val) => [`${val} suppliers`, 'Count']}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
