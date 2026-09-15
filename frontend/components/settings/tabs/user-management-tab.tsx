'use client'

import React from 'react'
import {
  Users,
  UserPlus,
  Search,
  Key,
  Edit2,
  Shield,
  CheckCircle2,
  XCircle,
  UserCheck,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ErrorCard } from '@/components/ui/error-card'
import { useAuth } from '@/lib/auth-context'
import { useUserManagement } from '../hooks/use-user-management'
import { CreateUserModal } from '../modals/create-user-modal'
import { EditUserModal } from '../modals/edit-user-modal'
import { ResetPasswordModal } from '../modals/reset-password-modal'

const ROLE_BADGE_MAP: Record<string, { label: string; className: string }> = {
  admin: { label: 'System Administrator', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  reviewer: { label: 'Risk Reviewer', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  verifier: { label: 'Compliance Verifier', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  process_owner: { label: 'Process Owner', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
}

export function UserManagementTab() {
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const {
    users,
    allUsers,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    loadUsers,
    isCreateOpen,
    setIsCreateOpen,
    isEditOpen,
    setIsEditOpen,
    isResetOpen,
    setIsResetOpen,
    selectedUser,
    setSelectedUser,
    createdCredentials,
    setCreatedCredentials,
    resetCredentials,
    setResetCredentials,
    handleCreateUser,
    handleUpdateUser,
    handleToggleActive,
    handleResetPassword,
  } = useUserManagement(isAdmin)

  if (!isAdmin) {
    return (
      <Card className="border-border">
        <CardContent className="py-12 flex flex-col items-center text-center space-y-3">
          <div className="p-3 rounded-xl bg-muted text-muted-foreground">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="font-bold text-foreground text-base">Administrative Access Restricted</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            User provisioning, role reassignment, and password resets require System Administrator privileges.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <ErrorCard title="User Directory Unavailable" message={error} onRetry={loadUsers} />
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-border">
          <span className="text-xs text-muted-foreground">Total Accounts</span>
          <p className="text-2xl font-bold text-foreground mt-1">{allUsers.length}</p>
        </Card>
        <Card className="p-4 border-border">
          <span className="text-xs text-muted-foreground">Active Users</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{allUsers.filter((u) => u.is_active).length}</p>
        </Card>
        <Card className="p-4 border-border">
          <span className="text-xs text-muted-foreground">Administrators</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">{allUsers.filter((u) => u.role.toLowerCase() === 'admin').length}</p>
        </Card>
        <Card className="p-4 border-border">
          <span className="text-xs text-muted-foreground">Review & Compliance</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">{allUsers.filter((u) => ['reviewer', 'verifier'].includes(u.role.toLowerCase())).length}</p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                User Accounts & Access Control
              </CardTitle>
              <CardDescription className="text-xs">
                Manage internal risk portal users, system roles, and account security.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="text-xs flex items-center gap-1.5 font-semibold">
              <UserPlus className="w-3.5 h-3.5" />
              Add User
            </Button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-3 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary sm:w-44"
            >
              <option value="all">All System Roles</option>
              <option value="admin">System Administrator</option>
              <option value="reviewer">Risk Reviewer</option>
              <option value="verifier">Compliance Verifier</option>
              <option value="process_owner">Process Owner</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">Loading accounts...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">No accounts found matching filters.</td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const roleMeta = ROLE_BADGE_MAP[u.role.toLowerCase()] || { label: u.role, className: 'bg-muted text-muted-foreground' }
                    const isSelf = currentUser?.id === u.user_id || currentUser?.email === u.email
                    return (
                      <tr key={u.user_id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs font-bold">
                                {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isSelf && <span className="text-[10px] text-primary font-mono font-medium">(You)</span>}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`text-[11px] font-medium border ${roleMeta.className}`}>
                            {roleMeta.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-medium">{u.department}</td>
                        <td className="py-3 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                              <XCircle className="w-3.5 h-3.5" /> Suspended
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit user"
                              onClick={() => { setSelectedUser(u); setIsEditOpen(true) }}
                              className="h-7 px-2 text-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reset password"
                              onClick={() => { setSelectedUser(u); setIsResetOpen(true) }}
                              className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </Button>
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title={u.is_active ? 'Suspend account' : 'Activate account'}
                                onClick={() => handleToggleActive(u)}
                                className={`h-7 px-2 text-xs ${u.is_active ? 'text-destructive hover:text-destructive' : 'text-emerald-600 hover:text-emerald-700'}`}
                              >
                                {u.is_active ? 'Suspend' : 'Activate'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onConfirm={handleCreateUser}
        createdCredentials={createdCredentials}
        onClearCredentials={() => setCreatedCredentials(null)}
      />

      <EditUserModal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setSelectedUser(null) }}
        onConfirm={handleUpdateUser}
        user={selectedUser}
      />

      <ResetPasswordModal
        isOpen={isResetOpen}
        onClose={() => { setIsResetOpen(false); setSelectedUser(null) }}
        onConfirm={handleResetPassword}
        user={selectedUser}
        credentials={resetCredentials}
        onClearCredentials={() => setResetCredentials(null)}
      />
    </div>
  )
}
