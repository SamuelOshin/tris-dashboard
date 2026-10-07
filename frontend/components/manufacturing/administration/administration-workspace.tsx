'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useDemoAccounts } from '@/components/login/hooks/use-demo-accounts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdministration } from './hooks/use-administration'
import { AuditTab } from './tabs/audit-tab'
import { DatasetsTab } from './tabs/datasets-tab'
import { ModelsTab } from './tabs/models-tab'
import { ProfilesTab } from './tabs/profiles-tab'
import { WeightsTab } from './tabs/weights-tab'

/** System administration: models, risk weights, datasets, saved mappings and the audit trail. */
export function AdministrationWorkspace() {
  const ws = useAdministration()
  const isDemo = useDemoAccounts().length > 0

  if (ws.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Administration could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{ws.error}</p>
      </div>
    )
  }
  if (!ws.config || !ws.weights || !ws.datasets || !ws.profiles) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-4">
      {isDemo && (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          This is a shared demonstration. Changes made here, such as switching a model off or saving
          new risk weights, are seen by the next person who signs in.
        </p>
      )}
      <Tabs defaultValue="models" className="space-y-5">
        <TabsList>
          <TabsTrigger value="models">Models &amp; settings</TabsTrigger>
          <TabsTrigger value="weights">Risk weights</TabsTrigger>
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
          <TabsTrigger value="profiles">Saved mappings</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="models">
          <ModelsTab config={ws.config} busy={ws.busy} onToggle={(m, on) => ws.setModel(m.code, on, null)} />
        </TabsContent>
        <TabsContent value="weights">
          <WeightsTab list={ws.weights} saving={ws.busy === 'weights'} onSave={ws.saveWeights} />
        </TabsContent>
        <TabsContent value="datasets">
          <DatasetsTab datasets={ws.datasets} busy={ws.busy} onLabel={ws.setLabel} />
        </TabsContent>
        <TabsContent value="profiles">
          <ProfilesTab profiles={ws.profiles} busy={ws.busy} onDelete={(p) => ws.deleteProfile(p.profile_id)} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
