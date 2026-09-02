'use client'

import { Card } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const chartData = [
  { time: '00:00', fraud: 2.4, risk: 2.4, access: 2.4 },
  { time: '04:00', fraud: 3.0, risk: 1.4, access: 2.2 },
  { time: '08:00', fraud: 2.0, risk: 9.6, access: 2.9 },
  { time: '12:00', fraud: 2.78, risk: 3.9, access: 2.0 },
  { time: '16:00', fraud: 1.89, risk: 4.3, access: 2.1 },
  { time: '20:00', fraud: 2.39, risk: 1.1, access: 2.6 },
  { time: '24:00', fraud: 2.78, risk: 2.9, access: 2.5 },
]

export function OverviewDashboard() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Risk Timeline</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" stroke="var(--muted-foreground)" />
            <YAxis stroke="var(--muted-foreground)" />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="fraud" stroke="var(--destructive)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="risk" stroke="var(--warning)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="access" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
