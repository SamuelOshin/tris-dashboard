'use client'

import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatMoney, formatTimestamp, STATUS_LABEL } from './material-cost-guards'
import { PriceTrend } from './price-trend'
import type { MaterialDetail, SignalDetail } from './types'

interface Props {
  open: boolean
  loading: boolean
  detail: MaterialDetail | null
  onClose: () => void
}

function StatusIcon({ status }: { status: SignalDetail['status'] }) {
  if (status === 'triggered') return <CircleAlert className="size-4 text-amber-600" />
  if (status === 'clear') return <CheckCircle2 className="size-4 text-emerald-600" />
  return <CircleDashed className="size-4 text-muted-foreground" />
}

function SignalList({ signals }: { signals: SignalDetail[] }) {
  return (
    <ul className="space-y-2">
      {signals.map((s) => (
        <li key={s.code} className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <StatusIcon status={s.status} />
            <span className="text-sm font-medium text-foreground">{s.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{STATUS_LABEL[s.status]}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.explanation}</p>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Body({ detail }: { detail: MaterialDetail }) {
  const products = detail.signals.find((s) => s.code === 'bom_cost_escalation')?.details
    .products as { product_sku: string; unit_cost_now: number; change_pct: number | null }[] | undefined
  return (
    <div className="space-y-6 px-4 pb-6">
      <Section title="Signals">
        <SignalList signals={detail.signals} />
      </Section>
      <Section title="Purchase price by month">
        <PriceTrend points={detail.price_series} currency={detail.currency} />
      </Section>
      {detail.supplier_spend.length > 0 && (
        <Section title="Suppliers (last 12 months)">
          <ul className="space-y-1 text-sm">
            {detail.supplier_spend.map((s) => (
              <li key={s.supplier_id} className="flex justify-between">
                <span className="text-foreground">{s.supplier_id}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(s.spend, detail.currency)} · {s.share_pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {products && products.length > 0 && (
        <Section title="Products using this material">
          <ul className="space-y-1 text-sm">
            {products.map((p) => (
              <li key={p.product_sku} className="flex justify-between">
                <span className="text-foreground">{p.product_sku}</span>
                <span className="tabular-nums text-muted-foreground">
                  material cost {formatMoney(p.unit_cost_now, detail.currency)} per unit
                  {p.change_pct != null && ` (${p.change_pct > 0 ? '+' : ''}${p.change_pct}% in 90 days)`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {detail.notes.length > 0 && (
        <Section title="Data notes">
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {detail.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </Section>
      )}
      <p className="text-xs text-muted-foreground">
        Based on data up to {formatDate(detail.as_of)} · calculated {formatTimestamp(detail.computed_at)}
        {detail.dataset_ids.length > 0 && ` · dataset: ${detail.dataset_ids.join(', ')}`}
      </p>
    </div>
  )
}

export function MaterialDetailSheet({ open, loading, detail, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{detail?.description ?? 'Material'}</SheetTitle>
          <SheetDescription>
            {detail ? `${detail.material_id}${detail.category ? ` · ${detail.category}` : ''}` : ' '}
          </SheetDescription>
        </SheetHeader>
        {loading && (
          <div className="space-y-3 px-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {detail && <Body detail={detail} />}
      </SheetContent>
    </Sheet>
  )
}
