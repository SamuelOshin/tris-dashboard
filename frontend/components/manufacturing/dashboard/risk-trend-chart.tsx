'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../material-cost/material-cost-guards'
import type { TrendPoint } from './types'

function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

/** One bar per set of stored scores: how many materials were High or Critical in that set. */
export function RiskTrendChart({ points }: { points: TrendPoint[] }) {
  const data = points.map((p) => ({
    label: `${shortDate(p.as_of)} · v${p.weight_version}`,
    full: `Data up to ${formatDate(p.as_of)}, weights version ${p.weight_version}`,
    high: p.high_or_critical,
    scored: p.scored,
  }))
  return (
    <div className="tris-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Material-cost risk trend</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Materials scored High or Critical in each set of saved scores. Each set keeps its own
        weight version.
      </p>
      {data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No risk scores are saved yet. Calculate them on the Material Cost Intelligence page.
        </p>
      ) : (
        <div
          className="mt-3 h-52 text-primary"
          role="img"
          aria-label="Bar chart of High or Critical materials per set of saved scores"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                strokeOpacity={0.1}
                vertical={false}
              />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(_label, items) => items?.[0]?.payload.full ?? ''}
                formatter={(value, _name, item) => [
                  `${value} of ${item.payload.scored} scored`,
                  'High or Critical',
                ]}
              />
              <Bar dataKey="high" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
