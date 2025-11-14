'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, TrendingUp, TrendingDown } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  category: string
  rating: 'A' | 'B' | 'C' | 'D'
  riskScore: number
  trend: 'up' | 'down' | 'stable'
  volume: number
  reliability: number
  compliance: string
}

const suppliers: Supplier[] = [
  {
    id: '1',
    name: 'TechSystems Global',
    category: 'Electronics',
    rating: 'A',
    riskScore: 12,
    trend: 'down',
    volume: 2400000,
    reliability: 99,
    compliance: 'Full'
  },
  {
    id: '2',
    name: 'Industrial Metals Co',
    category: 'Materials',
    rating: 'B',
    riskScore: 38,
    trend: 'up',
    volume: 1800000,
    reliability: 94,
    compliance: 'Full'
  },
  {
    id: '3',
    name: 'Premium Parts Ltd',
    category: 'Electronics',
    rating: 'A',
    riskScore: 15,
    trend: 'stable',
    volume: 1600000,
    reliability: 98,
    compliance: 'Full'
  },
  {
    id: '4',
    name: 'FastTrack Logistics',
    category: 'Logistics',
    rating: 'B',
    riskScore: 52,
    trend: 'up',
    volume: 950000,
    reliability: 89,
    compliance: 'Partial'
  },
  {
    id: '5',
    name: 'Eastern Supply Chain',
    category: 'Materials',
    rating: 'C',
    riskScore: 68,
    trend: 'up',
    volume: 720000,
    reliability: 82,
    compliance: 'Pending'
  },
  {
    id: '6',
    name: 'QuickManufacture Inc',
    category: 'Manufacturing',
    rating: 'C',
    riskScore: 75,
    trend: 'up',
    volume: 580000,
    reliability: 76,
    compliance: 'Pending'
  },
]

export function SupplierTable() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Supplier Directory</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Supplier</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Category</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Rating</th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Risk Score</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Trend</th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Annual Volume</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Reliability</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Compliance</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground">{supplier.name}</td>
                <td className="py-3 px-4 text-muted-foreground">{supplier.category}</td>
                <td className="py-3 px-4 text-center">
                  <Badge className={`${
                    supplier.rating === 'A' ? 'bg-success/20 text-success' :
                    supplier.rating === 'B' ? 'bg-accent/20 text-accent' :
                    'bg-warning/20 text-warning'
                  }`}>
                    {supplier.rating}-Tier
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs ${
                    supplier.riskScore > 60 ? 'bg-destructive/10 text-destructive' :
                    supplier.riskScore > 40 ? 'bg-warning/10 text-warning' :
                    'bg-success/10 text-success'
                  }`}>
                    {supplier.riskScore}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  {supplier.trend === 'down' && <TrendingDown className="w-4 h-4 text-success inline" />}
                  {supplier.trend === 'up' && <TrendingUp className="w-4 h-4 text-destructive inline" />}
                  {supplier.trend === 'stable' && <div className="w-4 h-4 text-muted-foreground inline">−</div>}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-foreground">${(supplier.volume / 1000000).toFixed(1)}M</td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-8 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-success"
                        style={{ width: `${supplier.reliability}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{supplier.reliability}%</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge className={`${
                    supplier.compliance === 'Full' ? 'bg-success/20 text-success' :
                    supplier.compliance === 'Partial' ? 'bg-warning/20 text-warning' :
                    'bg-destructive/20 text-destructive'
                  }`}>
                    {supplier.compliance}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-center">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
