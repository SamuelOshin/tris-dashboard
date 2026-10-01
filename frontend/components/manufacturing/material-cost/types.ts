export type SignalStatus = 'triggered' | 'clear' | 'not_evaluable'

export interface SignalSummary {
  code: string
  name: string
  status: SignalStatus
  explanation: string
}

export interface SignalDetail extends SignalSummary {
  value: number | null
  threshold: number | null
  details: Record<string, unknown>
}

export interface MaterialRow {
  material_id: string
  description: string
  category: string | null
  unit_of_measure: string
  currency: string | null
  suppliers: string[]
  latest_price: number | null
  latest_price_month: string | null
  price_change_1m_pct: number | null
  price_change_3m_pct: number | null
  standard_cost: number | null
  vs_standard_pct: number | null
  history_months: number
  purchase_lines: number
  top_supplier: string | null
  top_supplier_share_pct: number | null
  coverage_days: number | null
  inventory_value: number | null
  latest_lead_time_days: number | null
  bom_product_count: number
  spend_window_total: number
  spend_share_pct: number | null
  triggered_count: number
  signals: SignalSummary[]
  notes: string[]
}

export interface OverviewSummary {
  materials_total: number
  materials_shown: number
  materials_with_signals: number
  signals_by_code: Record<string, number>
  spend_window_days: number
  spend_window_total: number | null
  spend_by_currency: Record<string, number>
  currencies: string[]
}

export interface Overview {
  has_data: boolean
  notice?: string | null
  as_of: string | null
  first_purchase_date?: string
  computed_at: string
  materials: MaterialRow[]
  summary: OverviewSummary | null
  filter_options: { categories: string[]; suppliers: string[]; products: string[] } | null
  signal_catalog: { code: string; name: string }[]
  datasets: string[]
  pending_capabilities: string[]
}

export interface PricePoint {
  month: string
  unit_price: number
  quantity: number
  standard_cost: number | null
}

export interface SupplierSpend {
  supplier_id: string
  spend: number
  share_pct: number
}

export interface MaterialDetail extends Omit<MaterialRow, 'signals'> {
  as_of: string
  computed_at: string
  signals: SignalDetail[]
  price_series: PricePoint[]
  supplier_spend: SupplierSpend[]
  spend_without_supplier: number
  dataset_ids: string[]
}

export interface Filters {
  asOf: string
  category: string
  search: string
  supplier: string
  product: string
  signal: string
  dataset: string
}

export const EMPTY_FILTERS: Filters = {
  asOf: '',
  category: '',
  search: '',
  supplier: '',
  product: '',
  signal: '',
  dataset: '',
}
