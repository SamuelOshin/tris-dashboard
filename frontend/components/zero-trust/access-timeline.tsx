'use client'

import { Card } from '@/components/ui/card'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const timelineData = [
  { time: '00:00', legitimate: 450, suspicious: 8, blocked: 2 },
  { time: '04:00', legitimate: 320, suspicious: 12, blocked: 4 },
  { time: '08:00', legitimate: 780, suspicious: 18, blocked: 3 },
  { time: '12:00', legitimate: 920, suspicious: 25, blocked: 6 },
  { time: '16:00', legitimate: 850, suspicious: 22, blocked: 5 },
  { time: '20:00', legitimate: 620, suspicious: 15, blocked: 2 },
  { time: '24:00', legitimate: 380, suspicious: 10, blocked: 1 },
]

export function AccessTimeline() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Access Activity Timeline</h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={timelineData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" stroke="var(--muted-foreground)" />
          <YAxis stroke="var(--muted-foreground)" />
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
          />
          <Area type="monotone" dataKey="legitimate" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Legitimate" />
          <Area type="monotone" dataKey="suspicious" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.3} name="Suspicious" />
          <Area type="monotone" dataKey="blocked" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Blocked" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}
