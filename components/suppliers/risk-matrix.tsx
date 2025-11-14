'use client'

import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const riskData = [
  { category: 'Financial', low: 45, medium: 28, high: 15, critical: 4 },
  { category: 'Operational', low: 38, medium: 35, high: 20, critical: 7 },
  { category: 'Compliance', low: 52, medium: 22, high: 18, critical: 3 },
  { category: 'Geopolitical', low: 41, medium: 30, high: 22, critical: 5 },
]

export function RiskMatrix() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Risk Distribution by Category</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={riskData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="category" stroke="var(--muted-foreground)" />
          <YAxis stroke="var(--muted-foreground)" />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Bar dataKey="low" stackId="a" fill="#22c55e" name="Low Risk" />
          <Bar dataKey="medium" stackId="a" fill="#eab308" name="Medium Risk" />
          <Bar dataKey="high" stackId="a" fill="#f97316" name="High Risk" />
          <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
