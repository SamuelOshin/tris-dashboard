import { AdministrationWorkspace } from '@/components/manufacturing/administration/administration-workspace'
import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'

export const metadata = {
  title: 'Administration - TRIS',
  description: 'Forecast models, risk weights, datasets, saved mappings and the audit log',
}

export default function AdministrationPage() {
  return (
    <ManufacturingPage pageId="administration">
      <AdministrationWorkspace />
    </ManufacturingPage>
  )
}
