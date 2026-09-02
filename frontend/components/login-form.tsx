'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { AlertCircle, Loader } from 'lucide-react'
import Link from 'next/link'

interface DemoUser {
  email: string
  role: string
  password: string
}

const DEMO_USERS: DemoUser[] = [
  { email: 'reviewer@tris.internal', role: 'Risk Reviewer (Finance)', password: 'password123' },
  { email: 'verifier@tris.internal', role: 'Compliance Verifier', password: 'password123' },
  { email: 'sarah@company.com', role: 'CFO (Executive)', password: 'password' },
  { email: 'admin@tris.internal', role: 'System Admin', password: 'admin123' },
]

export function LoginForm() {
  const [email, setEmail] = useState('reviewer@tris.internal')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      router.push('/')
    } catch (err) {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (demoUser: DemoUser) => {
    setEmail(demoUser.email)
    setPassword(demoUser.password)
    setLoading(true)
    setError('')

    try {
      await login(demoUser.email, demoUser.password)
      router.push('/')
    } catch (err) {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          {/* Header */}
          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-bold text-foreground">TRIS Login</h1>
            <p className="text-sm text-muted-foreground">Zero-Trust Risk & Integrity Studio</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <Input
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>

          {/* Demo Users */}
          <div className="space-y-3 pt-6 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Demo Users</p>
            <div className="grid gap-2">
              {DEMO_USERS.map((demoUser) => (
                <button
                  key={demoUser.email}
                  onClick={() => quickLogin(demoUser)}
                  disabled={loading}
                  className="w-full p-3 text-left bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  <div className="font-medium">{demoUser.role}</div>
                  <div className="text-xs opacity-75">{demoUser.email}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Demo credentials: password is 'password' for all accounts
        </p>
      </div>
    </div>
  )
}
