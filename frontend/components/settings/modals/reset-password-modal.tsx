'use client'

import React, { useState } from 'react'
import { X, Key, Check, Copy, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAdminRecord } from '@/lib/api'

interface ResetPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (userId: string) => Promise<boolean>
  user: UserAdminRecord | null
  credentials: { username: string; tempPass: string } | null
  onClearCredentials: () => void
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  user,
  credentials,
  onClearCredentials,
}: ResetPasswordModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isOpen || !user) return null

  const handleClose = () => {
    onClearCredentials()
    onClose()
  }

  const handleReset = async () => {
    setSubmitting(true)
    await onConfirm(user.user_id)
    setSubmitting(false)
  }

  const handleCopy = () => {
    if (credentials?.tempPass) {
      navigator.clipboard.writeText(credentials.tempPass)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-500">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Key className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Reset Password</h3>
              <p className="text-xs text-muted-foreground font-mono">{user.username}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {credentials ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Temporary password generated</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                <span className="font-mono font-bold text-sm text-foreground">
                  {credentials.tempPass}
                </span>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
                  {copied ? (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Check className="w-3.5 h-3.5" /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </span>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide this temporary password to {user.name}. Their prior credentials have been invalidated.
            </p>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleClose} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                This will generate a new temporary password for <strong>{user.name}</strong> ({user.username}). Their existing password will immediately stop working.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} className="text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleReset}
                disabled={submitting}
                className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submitting ? 'Generating...' : 'Confirm Reset'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
