import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'

export const metadata = {
  title: 'Material Cost Intelligence - TRIS',
  description: 'Material price trends, deviations and bill-of-materials impact',
}

export default function MaterialCostPage() {
  return <ManufacturingPage pageId="material-cost" />
}
