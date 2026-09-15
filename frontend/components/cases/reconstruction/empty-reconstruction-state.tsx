'use client'

import React from 'react'
import { RotateCcw, AlertCircle, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EmptyReconstructionStateProps {
  transactionId?: string
  onTriggerReconstruction: () => void
  isLoading: boolean
}

export function EmptyReconstructionState({
  transactionId,
  onTriggerReconstruction,
  isLoading,
}: EmptyReconstructionStateProps) {
  if (!transactionId) {
    return (
      <Card className="p-8 text-center bg-card border-border/80 max-w-xl mx-auto my-8 space-y-4">
        <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">No Transaction Linked</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            This case was created without an associated financial transaction identifier. Historical event-time reconstruction requires an operational transaction anchor.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-8 text-center bg-card border-border/80 max-w-xl mx-auto my-8 space-y-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
        <RotateCcw className="w-6 h-6" />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Historical Event State Not Yet Reconstructed
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Reconstruct the cross-system state for transaction{' '}
          <code className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground font-semibold">
            {transactionId}
          </code>{' '}
          at its exact event timestamp. Approvals recorded after the event timestamp will be strictly excluded to prevent hindsight bias.
        </p>
      </div>

      <div className="pt-2">
        <Button
          onClick={onTriggerReconstruction}
          disabled={isLoading}
          size="sm"
          className="gap-2 text-xs font-semibold px-4"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>Reconstructing Historical State...</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Historical Reconstruction</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
