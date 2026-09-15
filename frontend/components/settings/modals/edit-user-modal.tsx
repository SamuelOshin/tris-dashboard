'use client'

import React, { useState, useEffect } from 'react'
import { X, UserCog, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAdminRecord, UserUpdatePayload } from '@/lib/api'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (userId: string, payload: UserUpdatePayload) => Promise<boolean>
  user: UserAdminRecord | null
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

export function EditUserModal({
  isOpen,
  onClose,
  onConfirm,
  user,
}: EditUserModalProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('reviewer')
  const [department, setDepartment] = useState('Operations')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setRole(user.role.toLowerCase())
      setDepartment(user.department)
      setIsActive(user.is_active)
    }
  }, [user])

  if (!isOpen || !user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const success = await onConfirm(user.user_id, {
      name: name.trim(),
      role,
      department: department.trim(),
      is_active: isActive,
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCog className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Edit User Account</h3>
              <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Full Name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">System Role</Label>
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
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold">Account Status</Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${
                  isActive ? 'bg-emerald-600' : 'bg-muted'
                }`}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-medium text-foreground">
                {isActive ? 'Active (Permitted to sign in)' : 'Suspended (Access blocked)'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !name.trim()}
              className="text-xs font-semibold"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
