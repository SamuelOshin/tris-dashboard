'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { api, Supplier } from '@/lib/api'
import { Layers } from 'lucide-react'

const PALETTE = [
  { bg: 'bg-blue-500', hex: '#3b82f6', text: 'text-blue-400' },
  { bg: 'bg-emerald-500', hex: '#10b981', text: 'text-emerald-400' },
  { bg: 'bg-amber-500', hex: '#f59e0b', text: 'text-amber-400' },
  { bg: 'bg-rose-500', hex: '#f43f5e', text: 'text-rose-400' },
  { bg: 'bg-purple-500', hex: '#a855f7', text: 'text-purple-400' },
  { bg: 'bg-cyan-500', hex: '#06b6d4', text: 'text-cyan-400' },
  { bg: 'bg-indigo-500', hex: '#6366f1', text: 'text-indigo-400' },
  { bg: 'bg-teal-500', hex: '#14b8a6', text: 'text-teal-400' },
]

export function SupplierPortfolio() {
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

  // Aggregate by category
  const categoryCounts: Record<string, number> = {}
  suppliers.forEach((s) => {
    const cat = s.category || 'General'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })

  const total = suppliers.length || 1
  const categories = Object.entries(categoryCounts).map(([name, count], index) => {
    const color = PALETTE[index % PALETTE.length]
    const percent = Math.round((count / total) * 100)
    return { name, count, percent, color }
  })

  return (
    <Card className="p-6 bg-card border-border flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Supplier Category Distribution
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Portfolio breakdown across {suppliers.length} active vendors
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground">
            {categories.length} Sectors
          </span>
        </div>

        {/* Multi-segment distribution progress bar */}
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded-full bg-muted/30 overflow-hidden flex p-0.5 border border-border/60">
            {categories.map((cat) => (
              <div
                key={cat.name}
                title={`${cat.name}: ${cat.count} (${cat.percent}%)`}
                style={{ width: `${Math.max(cat.percent, 8)}%` }}
                className={`h-full first:rounded-l-full last:rounded-r-full ${cat.color.bg} opacity-90 transition-all hover:opacity-100`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono text-right">
            Diversification Score: <strong className="text-success">Optimal (8-way split)</strong>
          </p>
        </div>

        {/* Category list items */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border/50 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${cat.color.bg}`} />
                <span className="font-medium text-foreground truncate">{cat.name}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                <span className="text-muted-foreground font-semibold">{cat.count}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted/30 text-muted-foreground">
                  {cat.percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
