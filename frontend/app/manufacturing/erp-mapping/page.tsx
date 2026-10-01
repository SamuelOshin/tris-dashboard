import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'
import { ErpMappingWorkspace } from '@/components/manufacturing/erp-mapping/erp-mapping-workspace'

export const metadata = {
  title: 'ERP/BOM Data Mapping - TRIS',
  description: 'Map source ERP and bill-of-materials files to the TRIS data structure',
}

export default function ErpMappingPage() {
  return (
    <ManufacturingPage pageId="erp-mapping">
      <ErpMappingWorkspace />
    </ManufacturingPage>
  )
}
