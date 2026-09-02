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

function mapBackendUser(beUser: BackendUser): User {
  return {
    id: beUser.user_id,
    name: beUser.name,
    email: beUser.email,
    role: beUser.role.toLowerCase() as UserRole,
    department: beUser.department,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On mount, verify session with backend via the HttpOnly cookie sent automatically
    const initAuth = async () => {
      try {
        const beUser = await api.getMe()
        setUser(mapBackendUser(beUser))
      } catch {
        // No valid session — user must sign in
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = async (emailOrUsername: string, password: string) => {
    // Attempt live FastAPI backend login — no fallback mock path.
    // If the backend rejects credentials (401) or is unreachable, the error
    // propagates to the caller and the login form displays it to the user.
    const { user: beUser } = await api.login(emailOrUsername, password)
    setUser(mapBackendUser(beUser))
    // Token is stored in the HttpOnly cookie set by the server response.
    // No localStorage storage. No document.cookie token write.
  }

  const logout = () => {
    api.logout().catch(() => {})
    setUser(null)
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
