'use client'

import React, { useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReopenModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<any>
  isLoading: boolean
}

export function ReopenModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: ReopenModalProps) {
  const [reopenReason, setReopenReason] = useState(
    'Additional supplier transaction received; reopening for active reconciliation.'
  )

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!reopenReason.trim()) return
    await onConfirm(reopenReason.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-500">
            <RotateCcw className="w-5 h-5" />
            <h3 className="font-bold text-foreground">Reopen Case</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Reopening an audit-closed case requires documenting the specific operational justification for the audit trail.
        </p>

        <div className="space-y-1.5 text-xs">
          <label className="font-semibold text-foreground">
            Reopening Justification <span className="text-destructive">*</span>
          </label>
          <textarea
            rows={3}
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="e.g. Additional anomalous transaction received for this supplier..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || !reopenReason.trim()}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          >
            {isLoading ? 'Reopening...' : 'Confirm Reopen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
