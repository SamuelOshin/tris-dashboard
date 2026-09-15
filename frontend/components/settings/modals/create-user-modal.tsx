'use client'

import React, { useState } from 'react'
import { X, UserPlus, Check, Copy, Shield, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserCreatePayload } from '@/lib/api'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: UserCreatePayload) => Promise<boolean>
  createdCredentials: { username: string; name: string; tempPass: string } | null
  onClearCredentials: () => void
}

const ROLES = [
  { value: 'reviewer', label: 'Risk Reviewer' },
  { value: 'verifier', label: 'Compliance Verifier' },
  { value: 'process_owner', label: 'Process Owner' },
  { value: 'admin', label: 'System Administrator' },
]

const DEPARTMENTS = [
  'Operations',
  'Finance',
  'Compliance',
  'Internal Audit',
  'Information Security',
  'Procurement',
]

export function CreateUserModal({
  isOpen,
  onClose,
  onConfirm,
  createdCredentials,
  onClearCredentials,
}: CreateUserModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('reviewer')
  const [department, setDepartment] = useState('Operations')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    setName('')
    setEmail('')
    setUsername('')
    setRole('reviewer')
    setDepartment('Operations')
    setTemporaryPassword('')
    onClearCredentials()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    const success = await onConfirm({
      name: name.trim(),
      email: email.trim(),
      username: username.trim() || undefined,
      role,
      department: department.trim() || 'Operations',
      temporary_password: temporaryPassword.trim() || undefined,
    })
    setSubmitting(false)
  }

  const handleCopy = () => {
    if (createdCredentials?.tempPass) {
      navigator.clipboard.writeText(createdCredentials.tempPass)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">
                {createdCredentials ? 'Account Provisioned' : 'Create User Account'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {createdCredentials
                  ? 'Copy the initial temporary credentials below.'
                  : 'Assign system role and permissions.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {createdCredentials ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Account ready for {createdCredentials.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Username:</span>
                  <p className="font-mono font-medium text-foreground">{createdCredentials.username}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Temporary Password:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border">
                      {createdCredentials.tempPass}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-6 px-2 text-xs"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Please securely share these credentials with the user. They can update their password under Account Profile.
            </p>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleClose} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Corporate Email *</Label>
                <Input
                  required
                  type="email"
                  placeholder="jane.doe@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Username (Optional)</Label>
                <Input
                  placeholder="Auto-derived from email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">System Role *</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Department</Label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Custom Initial Password</Label>
                <Input
                  type="password"
                  placeholder="Auto-generated if empty"
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !name.trim() || !email.trim()}
                className="text-xs font-semibold"
              >
                {submitting ? 'Creating...' : 'Provision User'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
