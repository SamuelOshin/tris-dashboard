import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'
import { MaterialCostWorkspace } from '@/components/manufacturing/material-cost/material-cost-workspace'

export const metadata = {
  title: 'Material Cost Intelligence - TRIS',
  description: 'Material price trends, deviations and bill-of-materials impact',
}

export default function MaterialCostPage() {
  return (
    <ManufacturingPage pageId="material-cost">
      <MaterialCostWorkspace />
    </ManufacturingPage>
  )
}
