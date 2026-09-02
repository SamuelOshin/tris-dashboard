'use client'

import { createContext, useContext, useState, useEffect } from 'react'

export type UserRole = 'cfo' | 'procurement' | 'compliance' | 'security' | 'admin'

interface User {
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
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock users for demonstration
const MOCK_USERS: Record<string, User> = {
  cfo: { id: '1', name: 'Sarah Chen', email: 'sarah@company.com', role: 'cfo', department: 'Finance' },
  procurement: { id: '2', name: 'James Wilson', email: 'james@company.com', role: 'procurement', department: 'Procurement' },
  compliance: { id: '3', name: 'Maria Garcia', email: 'maria@company.com', role: 'compliance', department: 'Compliance' },
  security: { id: '4', name: 'David Kim', email: 'david@company.com', role: 'security', department: 'Security' },
  admin: { id: '5', name: 'Alex Morgan', email: 'alex@company.com', role: 'admin', department: 'Administration' },
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate checking stored auth session
    const storedUser = localStorage.getItem('tris_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Simulate login - in production, this would call an API
    const userKey = Object.keys(MOCK_USERS).find(key => 
      MOCK_USERS[key].email === email
    )
    
    if (userKey && password === 'password') {
      const foundUser = MOCK_USERS[userKey]
      setUser(foundUser)
      localStorage.setItem('tris_user', JSON.stringify(foundUser))
    } else {
      throw new Error('Invalid credentials')
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('tris_user')
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
