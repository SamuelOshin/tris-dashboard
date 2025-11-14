'use client'

import { Card } from '@/components/ui/card'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

const anomalyData = [
  { amount: 1200, frequency: 45, risk: 15 },
  { amount: 1800, frequency: 52, risk: 28 },
  { amount: 5000, frequency: 8, risk: 85 },
  { amount: 2200, frequency: 38, risk: 32 },
  { amount: 950, frequency: 88, risk: 12 },
  { amount: 8500, frequency: 3, risk: 92 },
  { amount: 3100, frequency: 22, risk: 45 },
  { amount: 1500, frequency: 65, risk: 22 },
  { amount: 4200, frequency: 5, risk: 78 },
  { amount: 2800, frequency: 35, risk: 55 },
  { amount: 6200, frequency: 2, risk: 88 },
  { amount: 1100, frequency: 92, risk: 18 },
]

const getColor = (risk: number) => {
  if (risk > 75) return '#ef4444'
  if (risk > 50) return '#f97316'
  if (risk > 25) return '#eab308'
  return '#22c55e'
}

export function AnomalyChart() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Transaction Risk Analysis</h2>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis 
            type="number" 
            dataKey="amount" 
            name="Transaction Amount ($)" 
            stroke="var(--muted-foreground)"
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <YAxis 
            type="number" 
            dataKey="frequency" 
            name="Historical Frequency" 
            stroke="var(--muted-foreground)"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--foreground)'
            }}
            cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
            formatter={(value, name) => {
              if (name === 'amount') return [`$${value.toLocaleString()}`, 'Amount']
              if (name === 'frequency') return [value, 'Frequency (times)']
              return value
            }}
          />
          <Scatter name="Risk Level" data={anomalyData} fill="#8884d8">
            {anomalyData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.risk)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
          <span className="text-muted-foreground">Low Risk (&lt;25%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }}></div>
          <span className="text-muted-foreground">Medium Risk (25-50%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
          <span className="text-muted-foreground">High Risk (50-75%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
          <span className="text-muted-foreground">Critical (&gt;75%)</span>
        </div>
      </div>
    </Card>
  )
}
