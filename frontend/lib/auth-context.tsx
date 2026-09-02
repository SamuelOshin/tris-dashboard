'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { api, User as BackendUser } from './api'

export type UserRole = 'cfo' | 'procurement' | 'compliance' | 'security' | 'admin' | 'reviewer' | 'verifier'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (emailOrUsername: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MOCK_USERS: Record<string, User> = {
  reviewer: { id: 'USR-101', name: 'Risk Reviewer', email: 'reviewer@tris.internal', role: 'reviewer', department: 'Finance' },
  verifier: { id: 'USR-102', name: 'Compliance Verifier', email: 'verifier@tris.internal', role: 'verifier', department: 'Compliance' },
  admin: { id: 'USR-103', name: 'System Admin', email: 'admin@tris.internal', role: 'admin', department: 'Administration' },
  cfo: { id: '1', name: 'Sarah Chen', email: 'sarah@company.com', role: 'cfo', department: 'Finance' },
  procurement: { id: '2', name: 'James Wilson', email: 'james@company.com', role: 'procurement', department: 'Procurement' },
  compliance: { id: '3', name: 'Maria Garcia', email: 'maria@company.com', role: 'compliance', department: 'Compliance' },
  security: { id: '4', name: 'David Kim', email: 'david@company.com', role: 'security', department: 'Security' },
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem('tris_user')
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch {
          // ignore corrupted localstorage
        }
      }
      // Attempt verification with live backend if token exists
      const token = localStorage.getItem('tris_token')
      if (token) {
        try {
          const beUser = await api.getMe()
          const mapped: User = {
            id: beUser.user_id,
            name: beUser.name,
            email: beUser.email,
            role: (beUser.role.toLowerCase()) as UserRole,
            department: beUser.department,
          }
          setUser(mapped)
          localStorage.setItem('tris_user', JSON.stringify(mapped))
        } catch {
          // Keep stored user if offline or network glitch
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (emailOrUsername: string, password: string) => {
    try {
      // 1. Attempt live FastAPI backend login
      const { user: beUser, access_token } = await api.login(emailOrUsername, password)
      const mappedUser: User = {
        id: beUser.user_id,
        name: beUser.name,
        email: beUser.email,
        role: (beUser.role.toLowerCase()) as UserRole,
        department: beUser.department,
      }
      setUser(mappedUser)
      localStorage.setItem('tris_user', JSON.stringify(mappedUser))
      document.cookie = `access_token=${access_token}; path=/; SameSite=Lax`
      document.cookie = 'tris_auth_active=true; path=/; SameSite=Lax'
    } catch {
      // 2. Fallback to mock demo credentials if backend is offline
      const userKey = Object.keys(MOCK_USERS).find(key => 
        MOCK_USERS[key].email.toLowerCase() === emailOrUsername.toLowerCase() ||
        key.toLowerCase() === emailOrUsername.toLowerCase()
      )
      
      if (userKey && (password === 'password' || password === `${userKey}123`)) {
        const foundUser = MOCK_USERS[userKey]
        setUser(foundUser)
        localStorage.setItem('tris_user', JSON.stringify(foundUser))
        document.cookie = 'tris_auth_active=true; path=/; SameSite=Lax'
      } else {
        throw new Error('Invalid username or password')
      }
    }
  }

  const logout = () => {
    api.logout().catch(() => {})
    setUser(null)
    localStorage.removeItem('tris_user')
    localStorage.removeItem('tris_token')
    document.cookie = 'access_token=; path=/; max-age=0'
    document.cookie = 'tris_auth_active=; path=/; max-age=0'
  }

  const hasPermission = (roles: UserRole[]) => {
    return user ? roles.includes(user.role) : false
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
