'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  api,
  RiskCase,
  ReconstructionResult,
  RemediationReplayResult,
  ProposedControl,
} from '@/lib/api'
import { toast } from 'sonner'

export function useReconstructionWorkspace(caseData: RiskCase | null) {
  const [reconstruction, setReconstruction] = useState<ReconstructionResult | null>(null)
  const [replays, setReplays] = useState<RemediationReplayResult[]>([])
  const [activeReplay, setActiveReplay] = useState<RemediationReplayResult | null>(null)
  const [proposedControls, setProposedControls] = useState<ProposedControl[]>([])
  const [selectedControlId, setSelectedControlId] = useState<string>('PROP-CTRL-001')
  const [loading, setLoading] = useState<boolean>(false)
  const [replayLoading, setReplayLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const transactionId = caseData?.transaction_id

  // Load initial reconstruction, existing replays, and available controls
  const loadWorkspaceData = useCallback(async () => {
    if (!transactionId) {
      setReconstruction(null)
      setReplays([])
      setActiveReplay(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // 1. Fetch available proposed controls
      const controlsPromise = api.getProposedControls().catch(() => [] as ProposedControl[])

      // 2. Fetch existing replays for this transaction/case
      const replaysPromise = api.getReplays({
        transaction_id: transactionId,
        case_id: caseData?.case_id,
      }).catch(() => [] as RemediationReplayResult[])

      // 3. Fetch historical reconstruction (using transaction's canonical event time)
      const reconPromise = api.getHistoricalReconstruction(transactionId).catch((err) => {
        // May return 404 or missing evidence; capture as null for clean empty state
        return null
      })

      const [controls, existingReplays, reconResult] = await Promise.all([
        controlsPromise,
        replaysPromise,
        reconPromise,
      ])

      setProposedControls(controls)
      if (controls.length > 0 && !selectedControlId) {
        setSelectedControlId(controls[0].control_id)
      }

      setReplays(existingReplays)
      if (existingReplays.length > 0) {
        setActiveReplay(existingReplays[0])
      }

      setReconstruction(reconResult)
    } catch (err: any) {
      setError(err?.message || 'Failed to load historical reconstruction data')
    } finally {
      setLoading(false)
    }
  }, [transactionId, caseData?.case_id, selectedControlId])

  useEffect(() => {
    loadWorkspaceData()
  }, [loadWorkspaceData])

  // Run on-demand historical reconstruction
  const handleTriggerReconstruction = async () => {
    if (!transactionId) {
      toast.error('No associated transaction ID for this case')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await api.getHistoricalReconstruction(
        transactionId,
        undefined,
        caseData?.case_id
      )
      setReconstruction(result)
      toast.success('Historical event state reconstructed successfully')
    } catch (err: any) {
      const msg = err?.message || 'Historical reconstruction failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Run remediation replay simulation
  const handleRunReplay = async (overrideControlId?: string) => {
    if (!transactionId) {
      toast.error('No associated transaction found to replay control against')
      return
    }

    const controlToUse = overrideControlId || selectedControlId || 'PROP-CTRL-001'
    setReplayLoading(true)
    try {
      const replayResult = await api.runRemediationReplay({
        transaction_id: transactionId,
        control_id: controlToUse,
        case_id: caseData?.case_id,
      })

      setActiveReplay(replayResult)
      setReplays((prev) => [replayResult, ...prev.filter((r) => r.replay_id !== replayResult.replay_id)])
      toast.success(`Simulation complete: ${replayResult.replay_determination}`)

      // Refresh reconstruction if not already present
      if (!reconstruction) {
        await handleTriggerReconstruction()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to run remediation replay simulation')
    } finally {
      setReplayLoading(false)
    }
  }

  return {
    reconstruction,
    replays,
    activeReplay,
    proposedControls,
    selectedControlId,
    setSelectedControlId,
    setActiveReplay,
    loading,
    replayLoading,
    error,
    transactionId,
    actions: {
      refresh: loadWorkspaceData,
      triggerReconstruction: handleTriggerReconstruction,
      runReplay: handleRunReplay,
    },
  }
}
