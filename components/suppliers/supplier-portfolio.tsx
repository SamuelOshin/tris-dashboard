'use client'

import { Card } from '@/components/ui/card'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

const portfolioData = [
  { name: 'Electronics (A-Tier)', value: 35, color: '#22c55e' },
  { name: 'Materials (B-Tier)', value: 28, color: '#eab308' },
  { name: 'Manufacturing (C-Tier)', value: 22, color: '#f97316' },
  { name: 'Logistics (D-Tier)', value: 12, color: '#ef4444' },
  { name: 'Other (Unrated)', value: 3, color: '#8b5cf6' },
]

export function SupplierPortfolio() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Supplier Classification</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={portfolioData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {portfolioData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value}%`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        {portfolioData.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-muted-foreground">{item.name}</span>
            </div>
            <span className="font-semibold text-foreground">{item.value}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
