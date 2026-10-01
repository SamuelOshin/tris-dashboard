import { ManufacturingPage } from '@/components/manufacturing/manufacturing-page'

export const metadata = {
  title: 'Forecasting & Scenarios - TRIS',
  description: 'Material cost forecasts and what-if scenario analysis',
}

export default function ForecastingPage() {
  return <ManufacturingPage pageId="forecasting" />
}
