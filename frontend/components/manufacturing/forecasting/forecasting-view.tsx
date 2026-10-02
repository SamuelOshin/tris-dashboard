'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExposureWorkspace } from '../exposure/exposure-workspace'
import { ForecastWorkspace } from './forecast-workspace'

/** The Forecasting & Scenarios page body: stored price forecasts, and exposure with what-ifs. */
export function ForecastingView() {
  return (
    <Tabs defaultValue="forecast" className="space-y-5">
      <TabsList>
        <TabsTrigger value="forecast">Price forecast</TabsTrigger>
        <TabsTrigger value="exposure">Exposure &amp; scenarios</TabsTrigger>
      </TabsList>
      <TabsContent value="forecast">
        <ForecastWorkspace />
      </TabsContent>
      <TabsContent value="exposure">
        <ExposureWorkspace />
      </TabsContent>
    </Tabs>
  )
}
