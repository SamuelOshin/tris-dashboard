'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { TrendingUp } from 'lucide-react'

// Sample correlation data
const correlationData = [
  { month: 'Jan', fraudRisk: 65, supplierRisk: 72, accessViolations: 45 },
  { month: 'Feb', fraudRisk: 58, supplierRisk: 68, accessViolations: 52 },
  { month: 'Mar', fraudRisk: 72, supplierRisk: 75, accessViolations: 48 },
  { month: 'Apr', fraudRisk: 68, supplierRisk: 70, accessViolations: 61 },
  { month: 'May', fraudRisk: 81, supplierRisk: 82, accessViolations: 55 },
  { month: 'Jun', fraudRisk: 75, supplierRisk: 78, accessViolations: 67 },
]

const correlationMatrix = [
  { factor: 'Invoice Amount', fraudCorrelation: 0.87, supplierCorrelation: 0.64 },
  { factor: 'Vendor Location', fraudCorrelation: 0.72, supplierCorrelation: 0.91 },
  { factor: 'Payment Frequency', fraudCorrelation: 0.85, supplierCorrelation: 0.58 },
  { factor: 'Compliance History', fraudCorrelation: 0.68, supplierCorrelation: 0.95 },
  { factor: 'Access Patterns', fraudCorrelation: 0.76, supplierCorrelation: 0.62 },
]

export default function CorrelationPage() {
  return (
    <DashboardLayout
      title="Correlation Intelligence"
      description="Analyze relationships between fraud, supplier, and access risks"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Risk Correlation Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Multi-Risk Correlation Trends</CardTitle>
              <CardDescription>
                Monthly correlation between fraud risk, supplier risk, and access violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={correlationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="fraudRisk" stroke="hsl(var(--color-chart-1))" strokeWidth={2} name="Fraud Risk" />
                    <Line type="monotone" dataKey="supplierRisk" stroke="hsl(var(--color-chart-2))" strokeWidth={2} name="Supplier Risk" />
                    <Line type="monotone" dataKey="accessViolations" stroke="hsl(var(--color-chart-3))" strokeWidth={2} name="Access Violations" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Correlation Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Factor Correlations</CardTitle>
              <CardDescription>
                Correlation coefficients between individual factors and risk categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 font-semibold">Risk Factor</th>
                      <th className="text-right py-2 px-4 font-semibold">Fraud Correlation</th>
                      <th className="text-right py-2 px-4 font-semibold">Supplier Correlation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlationMatrix.map((row) => (
                      <tr key={row.factor} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{row.factor}</td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-orange-500 h-2 rounded-full"
                                style={{ width: `${row.fraudCorrelation * 100}%` }}
                              />
                            </div>
                            <span className="font-medium">{(row.fraudCorrelation * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${row.supplierCorrelation * 100}%` }}
                              />
                            </div>
                            <span className="font-medium">{(row.supplierCorrelation * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Strong correlation (0.95) between compliance history and supplier risk indicates vendor vetting effectiveness</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Invoice amount shows high fraud correlation (0.87) but moderate supplier correlation (0.64)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Vendor location is critical for supplier management but less predictive of fraud</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Access patterns show consistent correlation across all risk categories</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
