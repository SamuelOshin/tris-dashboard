'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { RiskCase, Transaction, formatCurrency } from '@/lib/api'
import { OverviewFilter } from '../types'

interface InvoiceLedgerTableProps {
  transactions: Transaction[]
  caseByTxMap: Map<string, RiskCase>
}

const FILTERS: { id: OverviewFilter; label: string }[] = [
  { id: 'all', label: 'Recent' },
  { id: 'high_risk', label: 'High Risk' },
  { id: 'missing_approval', label: 'Missing Approval' },
  { id: 'over_50k', label: 'Over $50k' },
]

function matchesFilter(tx: Transaction, hasCase: boolean, filter: OverviewFilter): boolean {
  switch (filter) {
    case 'high_risk':
      return hasCase || tx.amount >= 80000
    case 'missing_approval':
      return tx.approval_status === 'Missing'
    case 'over_50k':
      return tx.amount >= 50000
    default:
      return true
  }
}

/**
 * Third dashboard card: the audited invoice ledger.
 *
 * Filter state is local to this component, so switching pills re-renders only the
 * table instead of the whole dashboard tree.
 */
export function InvoiceLedgerTable({ transactions, caseByTxMap }: InvoiceLedgerTableProps) {
  const [activeFilter, setActiveFilter] = useState<OverviewFilter>('all')

  const recentTransactions = useMemo(() => transactions.slice(0, 10), [transactions])

  const filteredTransactions = useMemo(
    () =>
      recentTransactions.filter((tx) =>
        matchesFilter(tx, Boolean(caseByTxMap.get(tx.transaction_id)), activeFilter)
      ),
    [recentTransactions, caseByTxMap, activeFilter]
  )

  return (
    <Card className="p-6 sm:p-7 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] space-y-5">
      {/* Header with Title and Segmented Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Audited Invoices
          </h2>
          <p className="text-xs text-muted-foreground">
            Continuous relational ledger monitored against deterministic baselines
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveFilter(id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeFilter === id
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Clean, Borderless Ledger Table */}
      <div className="overflow-x-auto -mx-6 px-6 scrollbar-thin">
        <table className="w-full text-left text-xs min-w-[620px]">
          <thead className="text-muted-foreground/70 font-mono font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-3">Invoice Ref</th>
              <th className="py-3 px-3">Supplier ID</th>
              <th className="py-3 px-3">Invoice Date</th>
              <th className="py-3 px-3 text-right">Amount</th>
              <th className="py-3 px-3">Approval</th>
              <th className="py-3 px-3 text-right">Verification Status</th>
              <th className="py-3 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 font-mono">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans">
                  {transactions.length === 0
                    ? 'No audited invoices found. Import a transaction ledger to begin monitoring.'
                    : 'No invoices match the selected filter.'}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const caseForTx = caseByTxMap.get(tx.transaction_id)
                const isOutlier =
                  Boolean(caseForTx) || tx.amount >= 80000 || tx.approval_status === 'Missing'

                return (
                  <tr
                    key={tx.transaction_id}
                    className={`transition-colors rounded-xl ${
                      isOutlier
                        ? 'bg-destructive/5 hover:bg-destructive/10'
                        : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-semibold text-foreground">
                      {tx.invoice_number || tx.transaction_id}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground text-[11px]">
                        {tx.supplier_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground font-sans text-xs">
                      {tx.invoice_date}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-foreground">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3.5 px-3 font-sans">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-medium ${
                          tx.approval_status === 'Approved'
                            ? 'bg-success/10 text-success'
                            : tx.approval_status === 'Missing'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        {tx.approval_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-sans">
                      {isOutlier ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-destructive/15 text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          Flagged Anomaly
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-medium text-success">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <Link
                        href={caseForTx ? `/cases/${caseForTx.case_id}` : '/fraud-detection'}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        title={caseForTx ? `Investigate Case ${caseForTx.case_id}` : 'View Ledger'}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
