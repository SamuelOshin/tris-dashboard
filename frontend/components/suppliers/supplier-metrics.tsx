'use client'

import { Card } from '@/components/ui/card'
import { Users, AlertTriangle, Landmark, ShieldCheck } from 'lucide-react'
import { api, Supplier } from '@/lib/api'
import { useFetchData } from '@/hooks/use-fetch-data'
import { ErrorCard } from '@/components/ui/error-card'

export function SupplierMetrics() {
  const { data: suppliers, loading, error, refetch } = useFetchData<Supplier[]>(() =>
    api.getSuppliers(),
  )

  if (error) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <ErrorCard
          title="Failed to Load Supplier Summary"
          message={error}
          onRetry={refetch}
          className="sm:col-span-2 lg:col-span-4"
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5.5 space-y-3 bg-card border-0 rounded-2xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)]">
            <div className="h-3.5 bg-muted/40 rounded-lg w-1/2 animate-pulse" />
            <div className="h-7 bg-muted/20 rounded-lg w-1/3 animate-pulse" />
            <div className="h-3 bg-muted/20 rounded-lg w-2/3 animate-pulse" />
          </Card>
        ))}
      </div>
    )
  }

  const txs = suppliers ?? []

  const total = txs.length
  const highRisk = txs.filter((s) => s.risk_tier?.toLowerCase() === 'high').length
  const bankChanges = txs.filter((s) => Boolean(s.bank_change_date)).length
  const activeCount = txs.filter((s) => s.status?.toLowerCase() === 'active').length

  const metrics = [
    {
      label: 'Monitored Suppliers',
      value: String(total),
      subtext: 'Active vendor directory profiles under continuous surveillance',
      badge: 'Active Directory',
      badgeClass: 'bg-primary/10 text-primary border-primary/20',
      icon: <Users className="w-4 h-4" />,
      iconColor: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      label: 'High Risk Tier',
      value: String(highRisk),
      subtext: highRisk > 0 ? 'Vendors subject to mandatory heightened verification' : 'No suppliers classified under high risk',
      badge: highRisk > 0 ? 'Surveillance Active' : 'Normal',
      badgeClass: highRisk > 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-success/10 text-success border-success/20',
      icon: <AlertTriangle className="w-4 h-4" />,
      iconColor: highRisk > 0 ? 'text-destructive bg-destructive/10 border-destructive/20' : 'text-muted-foreground bg-muted/20 border-border',
    },
    {
      label: 'Recent Bank Changes',
      value: String(bankChanges),
      subtext: 'Rule R-002 lookback monitoring recent routing modifications',
      badge: bankChanges > 0 ? 'Under Review' : 'Verified Stable',
      badgeClass: bankChanges > 0 ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted/40 text-muted-foreground border-border',
      icon: <Landmark className="w-4 h-4" />,
      iconColor: bankChanges > 0 ? 'text-warning bg-warning/10 border-warning/20' : 'text-muted-foreground bg-muted/20 border-border',
    },
    {
      label: 'Qualified Vendors',
      value: `${activeCount}/${total}`,
      subtext: 'Operational suppliers in active compliant standing',
      badge: '100% Onboarded',
      badgeClass: 'bg-success/10 text-success border-success/20',
      icon: <ShieldCheck className="w-4 h-4" />,
      iconColor: 'text-success bg-success/10 border-success/20',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className="p-5.5 bg-card border-0 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f] transition-all duration-200 group flex flex-col justify-between"
        >
          {/* Header row */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase font-mono tracking-wider font-semibold text-muted-foreground">
                {metric.label}
              </p>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${metric.iconColor}`}>
                {metric.icon}
              </div>
            </div>

            {/* Metric value and badge */}
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-bold text-foreground font-mono tracking-tight">
                {metric.value}
              </span>
              <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${metric.badgeClass}`}>
                {metric.badge}
              </span>
            </div>
          </div>

          {/* Full-width explanatory footer with tooltip */}
          <div className="mt-3 pt-2.5 border-t border-border/50">
            <p
              className="text-[11px] text-muted-foreground leading-relaxed cursor-help"
              title={metric.subtext}
            >
              {metric.subtext}
            </p>
          </div>
        </Card>
      ))}
    </div>
  )
}
