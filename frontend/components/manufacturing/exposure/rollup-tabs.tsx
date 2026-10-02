'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DIMENSION_LABEL, formatAmount, signedMoneyTone } from './exposure-guards'
import type { Dimension, RollupBlock } from './types'

const NOTE: Record<Dimension, string> = {
  supplier: "Each material's exposure is split by the share of its recent purchases bought from each supplier.",
  product:
    'Split by bill-of-materials quantity times recent production volume. Materials without production data are shown as Unallocated.',
  category: 'Materials grouped by their category.',
}

function Table({ blocks, isScenario }: { blocks: RollupBlock[]; isScenario: boolean }) {
  if (blocks.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing to show.</p>
  }
  return (
    <div className="space-y-4">
      {blocks.map((b) => (
        <div key={b.currency} className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{b.currency}</th>
                <th className="px-3 py-2 font-medium">Materials</th>
                <th className="px-3 py-2 font-medium">Projected exposure</th>
                {isScenario && <th className="px-3 py-2 font-medium">Scenario exposure</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {b.groups.map((g) => (
                <tr key={g.key}>
                  <td className="px-3 py-2 text-foreground">{g.key}</td>
                  <td className="px-3 py-2">{g.materials}</td>
                  <td className={`px-3 py-2 ${signedMoneyTone(g.projected_exposure)}`}>
                    {formatAmount(g.projected_exposure, b.currency)}
                  </td>
                  {isScenario && (
                    <td className={`px-3 py-2 ${signedMoneyTone(g.scenario_exposure)}`}>
                      {formatAmount(g.scenario_exposure, b.currency)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

export function RollupTabs({ rollups, isScenario }: { rollups: Record<Dimension, RollupBlock[]>; isScenario: boolean }) {
  const dims = Object.keys(DIMENSION_LABEL) as Dimension[]
  return (
    <Tabs defaultValue="supplier" className="space-y-3">
      <TabsList>
        {dims.map((d) => (
          <TabsTrigger key={d} value={d}>
            By {DIMENSION_LABEL[d].toLowerCase()}
          </TabsTrigger>
        ))}
      </TabsList>
      {dims.map((d) => (
        <TabsContent key={d} value={d} className="space-y-2">
          <p className="text-xs text-muted-foreground">{NOTE[d]}</p>
          <Table blocks={rollups[d]} isScenario={isScenario} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
