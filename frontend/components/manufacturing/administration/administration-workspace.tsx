'use client'

import { Skeleton } from '@/components/ui/skeleton'
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
  )
}
