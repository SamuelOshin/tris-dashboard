'use client'

import React, { useState, useEffect } from 'react'
import { UserCheck, Shield, Mail, Building, Check, LogOut, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ProfileTab() {
  const { user, refreshUser, logout } = useAuth()
  const router = useRouter()

  const [name, setName] = useState(user?.name || '')
  const [department, setDepartment] = useState(user?.department || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setDepartment(user.department || '')
    }
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Full name cannot be empty')
      return
    }

    setSaving(true)
    try {
      await api.updateProfile({
        name: name.trim(),
        department: department.trim(),
      })
      await refreshUser()
      toast.success('Profile updated successfully', {
        description: 'Your changes have been saved to your account.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editable Profile Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  Account Details
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                  Active Session
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Update your display name and organizational department assignment.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name" className="text-xs font-semibold">
                    Full Name
                  </Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="h-10 text-xs bg-background"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-department" className="text-xs font-semibold">
                    Department
                  </Label>
                  <Input
                    id="profile-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Finance & Compliance"
                    className="h-10 text-xs bg-background"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    Changes persist directly to your user record in the relational store.
                  </p>
                  <Button
                    type="submit"
                    disabled={saving}
                    size="sm"
                    className="text-xs h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* System Credentials & Clearance */}
        <div className="space-y-6">
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Assigned Clearance
              </CardTitle>
              <CardDescription className="text-xs">
                System role and security permissions.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Email Address</p>
                <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  {user?.email || 'reviewer@tris.internal'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Role Clearance</p>
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px] font-mono uppercase bg-primary text-primary-foreground">
                    {user?.role || 'Reviewer'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">User Identifier</p>
                <p className="font-mono text-xs text-muted-foreground">{user?.id || 'USR-101'}</p>
              </div>

              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full text-xs h-9 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
