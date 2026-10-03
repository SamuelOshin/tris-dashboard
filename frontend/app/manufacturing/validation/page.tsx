import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'
import { ValidationWorkspace } from '@/components/manufacturing/validation/validation-workspace'

export const metadata = {
  title: 'Validation - TRIS',
  description: 'Retrospective checks of forecast and risk-signal accuracy',
}

export default function ValidationPage() {
  return (
    <ManufacturingPage pageId="validation">
      <ValidationWorkspace />
    </ManufacturingPage>
  )
}
