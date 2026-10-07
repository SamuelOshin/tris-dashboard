'use client'

import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { hasActiveFilters } from './material-cost-guards'
import type { Filters, Overview } from './types'

const ALL = '__all__'

interface Props {
  filters: Filters
  overview: Overview
  onChange: (key: keyof Filters, value: string) => void
  onClear: () => void
  level: string
  onLevelChange: (value: string) => void
}

function Choice(props: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={props.value || ALL} onValueChange={(v) => props.onChange(v === ALL ? '' : v)}>
      <SelectTrigger className="w-44" aria-label={props.label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{props.label}: all</SelectItem>
        {props.options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const RISK_LEVEL_OPTIONS = ['Critical', 'High', 'Moderate', 'Low', 'Not scored'].map((v) => ({
  value: v,
  label: v,
}))

const asOptions = (values: string[] = []) => values.map((v) => ({ value: v, label: v }))

export function FilterBar({ filters, overview, onChange, onClear, level, onLevelChange }: Props) {
  const options = overview.filter_options
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
          placeholder="Search material"
          aria-label="Search material"
          className="w-52 pl-8"
        />
      </div>
      <Choice label="Category" value={filters.category} options={asOptions(options?.categories)}
        onChange={(v) => onChange('category', v)} />
      <Choice label="Supplier" value={filters.supplier} options={asOptions(options?.suppliers)}
        onChange={(v) => onChange('supplier', v)} />
      <Choice label="Product" value={filters.product} options={asOptions(options?.products)}
        onChange={(v) => onChange('product', v)} />
      <Choice label="Signal" value={filters.signal}
        options={overview.signal_catalog.map((s) => ({ value: s.code, label: s.name }))}
        onChange={(v) => onChange('signal', v)} />
      <Choice label="Risk level" value={level} options={RISK_LEVEL_OPTIONS} onChange={onLevelChange} />
      {overview.datasets.length > 0 && (
        <Choice label="Dataset" value={filters.dataset} options={asOptions(overview.datasets)}
          onChange={(v) => onChange('dataset', v)} />
      )}
      <Input
        type="date"
        value={filters.asOf}
        onChange={(e) => onChange('asOf', e.target.value)}
        aria-label="Data up to date"
        className="w-40"
      />
      {(hasActiveFilters(filters) || filters.asOf || level) && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X />
          Clear filters
        </Button>
      )}
    </div>
  )
}
