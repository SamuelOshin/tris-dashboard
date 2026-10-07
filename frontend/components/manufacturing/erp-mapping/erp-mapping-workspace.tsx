'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { canImportData, canSaveProfiles } from './erp-mapping-guards'
import { useErpMappingWorkspace } from './hooks/use-erp-mapping-workspace'
import { MappingStep } from './mapping-step'
import { ResultPanel } from './result-panel'
import { UploadStep } from './upload-step'

const STEP_LABELS = ['Choose data', 'Match columns', 'Results'] as const
const STEP_ORDER = ['upload', 'mapping', 'results'] as const

function StepIndicator({ current }: { current: (typeof STEP_ORDER)[number] }) {
  const currentIndex = STEP_ORDER.indexOf(current)
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {STEP_LABELS.map((label, i) => (
        <li
          key={label}
          aria-current={i === currentIndex ? 'step' : undefined}
          className={`rounded-full px-3 py-1 font-medium ${
            i === currentIndex
              ? 'bg-primary text-primary-foreground'
              : i < currentIndex
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  )
}

/** Upload → match columns → results. The page stays a thin conductor over this component. */
export function ErpMappingWorkspace() {
  const { user } = useAuth()
  const ws = useErpMappingWorkspace()

  if (!canImportData(user?.role)) {
    return (
      <div className="tris-surface px-6 py-12 text-center">
        <h2 className="text-base font-semibold text-foreground">Importing data is restricted</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your account can review results but cannot upload or map source files. Contact an
          administrator if you need to import data.
        </p>
      </div>
    )
  }

  if (ws.metaError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">The mapping tool could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{ws.metaError}</p>
        <Button className="mt-3" variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    )
  }

  if (ws.targets.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <StepIndicator current={ws.step} />
      {ws.step === 'upload' && <UploadStep ws={ws} />}
      {ws.step === 'mapping' && (
        <MappingStep ws={ws} canSaveProfiles={canSaveProfiles(user?.role)} />
      )}
      {ws.step === 'results' && ws.outcome && (
        <div className="space-y-4">
          <ResultPanel outcome={ws.outcome} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => ws.setStep('mapping')}>
              Adjust mapping
            </Button>
            <Button onClick={ws.reset}>Import another file</Button>
          </div>
        </div>
      )}
    </div>
  )
}
