import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'

export const metadata = {
  title: 'ERP/BOM Data Mapping - TRIS',
  description: 'Map source ERP and bill-of-materials files to the TRIS data structure',
}

export default function ErpMappingPage() {
  return <ManufacturingPage pageId="erp-mapping" />
}
