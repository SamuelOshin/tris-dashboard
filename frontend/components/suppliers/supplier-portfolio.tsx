'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api, Supplier } from '@/lib/api'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export function SupplierPortfolio() {
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

  // Aggregate by category
  const categoryCounts: Record<string, number> = {}
  suppliers.forEach((s) => {
    const cat = s.category || 'General'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })

  const portfolioData = Object.entries(categoryCounts).map(([name, count], index) => ({
    name,
    value: count,
    color: COLORS[index % COLORS.length],
  }))

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">Supplier Category Distribution</h2>
      <p className="text-xs text-muted-foreground mb-4">Categorical breakdown of {suppliers.length} persisted vendors</p>
      
      {portfolioData.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
          No supplier data available
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={portfolioData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                dataKey="value"
              >
                {portfolioData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => `${val} vendors`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {portfolioData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-1.5 rounded bg-muted/20">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground truncate">{item.name}</span>
                </div>
                <span className="font-bold text-foreground ml-2">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
