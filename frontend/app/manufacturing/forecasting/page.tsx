import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'
import { ForecastWorkspace } from '@/components/manufacturing/forecasting/forecast-workspace'

export const metadata = {
  title: 'Forecasting & Scenarios - TRIS',
  description: 'Material cost forecasts and what-if scenario analysis',
}

export default function ForecastingPage() {
  return (
    <ManufacturingPage pageId="forecasting">
      <ForecastWorkspace />
    </ManufacturingPage>
  )
}
