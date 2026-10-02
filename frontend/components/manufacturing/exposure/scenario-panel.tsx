'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LIMITS } from './exposure-guards'
import type { ScenarioInputs } from './types'

type NumericField = keyof typeof LIMITS

interface Props {
  value: ScenarioInputs
  onChange: (next: ScenarioInputs) => void
  suppliers: string[]
  running: boolean
  canApply: boolean
  onApply: () => void
  onReset: () => void
}

interface FieldSpec {
  field: NumericField
  label: string
  hint: string
  unit: string
}

const FIELDS: FieldSpec[] = [
  { field: 'price_change_pct', label: 'Price change', hint: 'Applied to every forecast price.', unit: '%' },
  { field: 'demand_change_pct', label: 'Demand change', hint: 'Change in expected usage.', unit: '%' },
  { field: 'lead_time_delay_days', label: 'Delivery delay', hint: 'Days added to supplier lead time.', unit: 'days' },
  { field: 'inventory_change_pct', label: 'Stock on hand', hint: 'Change in the latest stock level.', unit: '%' },
  {
    field: 'spot_premium_pct',
    label: 'Rush-buy premium',
    hint: 'Extra price on usage that stock cannot cover. Leave at 0 to see cover only.',
    unit: '%',
  },
]

const toNumber = (raw: string) => (raw === '' ? Number.NaN : Number(raw))
const display = (n: number) => (Number.isNaN(n) ? '' : n)

function NumberField({ spec, value, onChange }: { spec: FieldSpec; value: number; onChange: (n: number) => void }) {
  const [min, max] = LIMITS[spec.field]
  const id = `scenario-${spec.field}`
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {spec.label} ({spec.unit})
      </label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="any"
        value={display(value)}
        onChange={(e) => onChange(toNumber(e.target.value))}
      />
      <p className="text-[11px] text-muted-foreground">{spec.hint}</p>
    </div>
  )
}

function SupplierField({ value, suppliers, set }: {
  value: ScenarioInputs
  suppliers: string[]
  set: (patch: Partial<ScenarioInputs>) => void
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor="scenario-supplier" className="text-xs font-medium text-foreground">
        Supplier price change
      </label>
      <div className="flex gap-2">
        <Select
          value={value.supplier_id ?? '__none'}
          onValueChange={(v) => set({ supplier_id: v === '__none' ? null : v })}
        >
          <SelectTrigger id="scenario-supplier" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">No supplier</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Supplier price change (%)"
          type="number"
          step="any"
          disabled={!value.supplier_id}
          value={display(value.supplier_price_change_pct)}
          onChange={(e) => set({ supplier_price_change_pct: toNumber(e.target.value) })}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">Applies to that supplier&apos;s share of usage (%).</p>
    </div>
  )
}

/** The what-if controls. They change a copy of the calculation; stored forecasts are never edited. */
export function ScenarioPanel({ value, onChange, suppliers, running, canApply, onApply, onReset }: Props) {
  const set = (patch: Partial<ScenarioInputs>) => onChange({ ...value, ...patch })
  return (
    <section className="space-y-4 rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">What-if scenario</h2>
        <p className="text-xs text-muted-foreground">
          Try a change and see the cost effect. This is a scenario, not a prediction, and nothing is saved.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((spec) => (
          <NumberField
            key={spec.field}
            spec={spec}
            value={value[spec.field]}
            onChange={(n) => set({ [spec.field]: n })}
          />
        ))}
        <SupplierField value={value} suppliers={suppliers} set={set} />
      </div>
      <div className="flex gap-2">
        <Button onClick={onApply} disabled={running || !canApply}>
          {running ? 'Calculating...' : 'Show scenario'}
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw /> Reset
        </Button>
      </div>
    </section>
  )
}
