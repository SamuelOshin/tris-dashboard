'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, UserAdminRecord, UserCreatePayload, UserUpdatePayload } from '@/lib/api'
import { toast } from 'sonner'

export function useUserManagement(enabled: boolean = true) {
  const [users, setUsers] = useState<UserAdminRecord[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserAdminRecord | null>(null)

  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string
    name: string
    tempPass: string
  } | null>(null)

  const [resetCredentials, setResetCredentials] = useState<{
    username: string
    tempPass: string
  } | null>(null)

  const loadUsers = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await api.getUsers()
      setUsers(data)
    } catch (err: any) {
      const msg = err?.message || 'Failed to load user roster.'
      setError(msg)
      toast.error('Unable to load users', { description: msg })
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (enabled) {
      loadUsers()
    } else {
      setLoading(false)
    }
  }, [enabled, loadUsers])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter.toLowerCase()
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      return matchesRole && matchesSearch
    })
  }, [users, roleFilter, searchQuery])

  const handleCreateUser = async (payload: UserCreatePayload) => {
    try {
      const res = await api.createUser(payload)
      setCreatedCredentials({
        username: res.username,
        name: res.name,
        tempPass: res.temporary_password,
      })
      toast.success('Account created', {
        description: `User '${res.username}' has been provisioned successfully.`,
      })
      await loadUsers()
      return true
    } catch (err: any) {
      toast.error('Creation failed', {
        description: err?.message || 'Could not create user account.',
      })
      return false
    }
  }

  const handleUpdateUser = async (userId: string, payload: UserUpdatePayload) => {
    try {
      const updated = await api.updateUser(userId, payload)
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? updated : u)))
      toast.success('Account updated', {
        description: `Details for '${updated.username}' were updated.`,
      })
      setIsEditOpen(false)
      setSelectedUser(null)
      return true
    } catch (err: any) {
      toast.error('Update failed', {
        description: err?.message || 'Could not update user details.',
      })
      return false
    }
  }

  const handleToggleActive = async (user: UserAdminRecord) => {
    const newStatus = !user.is_active
    try {
      const updated = await api.updateUser(user.user_id, { is_active: newStatus })
      setUsers((prev) => prev.map((u) => (u.user_id === user.user_id ? updated : u)))
      toast.success(newStatus ? 'Account activated' : 'Account deactivated', {
        description: `Access for '${user.username}' is now ${newStatus ? 'active' : 'suspended'}.`,
      })
    } catch (err: any) {
      toast.error('Status change failed', {
        description: err?.message || 'Could not update account status.',
      })
    }
  }

  const handleResetPassword = async (userId: string) => {
    try {
      const res = await api.resetUserPassword(userId)
      setResetCredentials({
        username: res.username,
        tempPass: res.temporary_password,
      })
      toast.success('Temporary password issued', {
        description: `New password generated for '${res.username}'.`,
      })
      return true
    } catch (err: any) {
      toast.error('Reset failed', {
        description: err?.message || 'Could not reset password.',
      })
      return false
    }
  }

  return {
    users: filteredUsers,
    allUsers: users,
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
  }
}
