import { request } from '@/lib/api'
import type { Filters, MaterialDetail, Overview } from './types'

const BASE = '/manufacturing/analytics'

function query(params: Record<string, string>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const materialCostApi = {
  overview: (f: Filters) =>
    request<Overview>(
      `${BASE}/overview${query({
        as_of: f.asOf,
        category: f.category,
        search: f.search,
        supplier_id: f.supplier,
        product_sku: f.product,
        signal: f.signal,
        dataset_id: f.dataset,
      })}`
    ),

  detail: (materialId: string, f: Filters) =>
    request<MaterialDetail>(
      `${BASE}/materials/${encodeURIComponent(materialId)}${query({
        as_of: f.asOf,
        dataset_id: f.dataset,
      })}`
    ),
}
