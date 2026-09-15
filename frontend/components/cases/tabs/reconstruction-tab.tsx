'use client'

import React from 'react'
import { RotateCcw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RiskCase } from '@/lib/api'
import { useReconstructionWorkspace } from '../hooks/use-reconstruction-workspace'
import { EmptyReconstructionState } from '../reconstruction/empty-reconstruction-state'
import { HistoricalStatePanel } from '../reconstruction/historical-state-panel'
import { RemediationReplayPanel } from '../reconstruction/remediation-replay-panel'

interface ReconstructionTabProps {
  caseData: RiskCase | null
}

export function ReconstructionTab({ caseData }: ReconstructionTabProps) {
  const {
    reconstruction,
    activeReplay,
    proposedControls,
    selectedControlId,
    setSelectedControlId,
    loading,
    replayLoading,
    error,
    transactionId,
    actions,
  } = useReconstructionWorkspace(caseData)

  if (loading && !reconstruction) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-mono">
            Reconstructing cross-system historical event state...
          </p>
        </div>
      </div>
    )
  }

  if (error && !reconstruction) {
    return (
      <Card className="p-8 text-center bg-card border-border/80 max-w-lg mx-auto my-8 space-y-3">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
        <h3 className="text-sm font-bold text-foreground">Reconstruction Error</h3>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button size="sm" variant="outline" onClick={actions.refresh} className="text-xs">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border/70 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">Historical Control State & Remediation Replay</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              TX: {transactionId || 'None'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Zero hindsight leakage: Evaluates controls strictly as-of event timestamp. Replay does not mutate active cases.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            size="sm"
            variant="outline"
            onClick={actions.refresh}
            disabled={loading || replayLoading}
            className="text-xs gap-1.5 h-8"
          >
            <RotateCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {!reconstruction ? (
        <EmptyReconstructionState
          transactionId={transactionId}
          onTriggerReconstruction={actions.triggerReconstruction}
          isLoading={loading}
        />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Historical State Reconstruction Panel */}
          <HistoricalStatePanel reconstruction={reconstruction} />

          {/* Section 2: Remediation Replay Comparison Panel */}
          <RemediationReplayPanel
            replay={activeReplay}
            proposedControls={proposedControls}
            selectedControlId={selectedControlId}
            onSelectControlId={setSelectedControlId}
            onRunReplay={actions.runReplay}
            isReplayLoading={replayLoading}
          />
        </div>
      )}
    </div>
  )
}
