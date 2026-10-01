import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'

export const metadata = {
  title: 'Validation - TRIS',
  description: 'Retrospective checks of forecast and risk-signal accuracy',
}

export default function ValidationPage() {
  return <ManufacturingPage pageId="validation" />
}
