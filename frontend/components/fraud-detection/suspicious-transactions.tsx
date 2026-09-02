'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface Transaction {
  id: string
  invoice: string
  vendor: string
  amount: number
  date: string
  status: 'flagged' | 'investigating' | 'cleared'
  risk: number
  reason: string
}

const transactions: Transaction[] = [
  {
    id: '1',
    invoice: 'INV-2024-8834',
    vendor: 'TechSupply Inc',
    amount: 8500,
    date: '2024-11-14',
    status: 'flagged',
    risk: 92,
    reason: 'Amount spike + unusual vendor'
  },
  {
    id: '2',
    invoice: 'INV-2024-8821',
    vendor: 'Parts Plus',
    amount: 6200,
    date: '2024-11-14',
    status: 'investigating',
    risk: 88,
    reason: 'Duplicate payment pattern detected'
  },
  {
    id: '3',
    invoice: 'INV-2024-8798',
    vendor: 'Industrial Solutions',
    amount: 5000,
    date: '2024-11-13',
    status: 'flagged',
    risk: 85,
    reason: 'Account mismatch + amount spike'
  },
  {
    id: '4',
    invoice: 'INV-2024-8756',
    vendor: 'Metal Works Ltd',
    amount: 4200,
    date: '2024-11-13',
    status: 'investigating',
    risk: 78,
    reason: 'Off-hours processing detected'
  },
  {
    id: '5',
    invoice: 'INV-2024-8734',
    vendor: 'Supplier Group',
    amount: 3100,
    date: '2024-11-12',
    status: 'flagged',
    risk: 45,
    reason: 'Invoice number format anomaly'
  },
]

export function SuspiciousTransactions() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Suspicious Transactions</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Invoice</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Vendor</th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Amount</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date</th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Risk Score</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Reason</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4 font-mono text-foreground">{tx.invoice}</td>
                <td className="py-3 px-4 text-foreground">{tx.vendor}</td>
                <td className="py-3 px-4 text-right font-semibold text-foreground">${(tx.amount / 1000).toFixed(1)}k</td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{tx.date}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm ${
                      tx.risk > 75 ? 'bg-destructive/10 text-destructive' :
                      tx.risk > 50 ? 'bg-warning/10 text-warning' :
                      'bg-accent/10 text-accent'
                    }`}>
                      {tx.risk}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {tx.status === 'flagged' && (
                    <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/30">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Flagged
                    </Badge>
                  )}
                  {tx.status === 'investigating' && (
                    <Badge className="bg-warning/20 text-warning hover:bg-warning/30">
                      <Clock className="w-3 h-3 mr-1" />
                      Investigating
                    </Badge>
                  )}
                  {tx.status === 'cleared' && (
                    <Badge className="bg-success/20 text-success hover:bg-success/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Cleared
                    </Badge>
                  )}
                </td>
                <td className="py-3 px-4 text-muted-foreground text-xs max-w-xs">{tx.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
