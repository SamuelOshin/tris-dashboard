'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Shield,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  UserCheck,
  Building,
  Building2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  FileSpreadsheet,
  ShieldAlert,
} from 'lucide-react'

interface DemoUser {
  email: string
  role: string
  title: string
  password: string
  icon: React.ComponentType<{ className?: string }>
}

const PRIMARY_DEMO_USER: DemoUser = {
  email: 'reviewer@tris.internal',
  role: 'Risk Reviewer / Case Owner',
  title: 'Primary Demo Persona',
  password: 'password123',
  icon: UserCheck,
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<{ title: string; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeDemoEmail, setActiveDemoEmail] = useState<string | null>(null)
  const [showForgotModal, setShowForgotModal] = useState(false)

  const { login } = useAuth()
  const router = useRouter()

  const resolveAuthError = (err: any, fallbackTitle = 'Sign in failed') => {
    const isServerError =
      (err?.status && err.status >= 500) ||
      err?.code === 'INTERNAL_SERVER_ERROR'
    const isNetworkError =
      err instanceof TypeError &&
      (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network'))

    let title = fallbackTitle
    let message = err?.message

    if (isServerError) {
      title = 'Server error'
      message = err?.message || 'An unexpected internal server error occurred. Please contact system administrator.'
    } else if (isNetworkError) {
      title = 'Connection error'
      message = 'Unable to connect to the authentication server. Please check your network connection.'
    } else if (!message) {
      message = 'Invalid email or password. Please check your credentials or select a demo sandbox persona below.'
    }

    return { title, message }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError({
        title: 'Missing credentials',
        message: 'Please enter both your email address and password to sign in.',
      })
      return
    }

    setError(null)
    setLoading(true)

    try {
      await login(email, password)
      toast.success('Signed in successfully', {
        description: 'Redirecting to your dashboard...',
      })
      router.push('/')
    } catch (err: any) {
      const authError = resolveAuthError(err, 'Sign in failed')
      setError(authError)
    } finally {
      setLoading(false)
    }
  }

  const selectDemoUser = (demoUser: DemoUser) => {
    setEmail(demoUser.email)
    setPassword(demoUser.password)
    setActiveDemoEmail(demoUser.email)
    setError(null)
    toast.info(`Filled credentials for ${demoUser.role}`, {
      description: 'Click "Sign in" to continue or edit the fields above.',
    })
  }

  const quickLoginDemoUser = async (demoUser: DemoUser, e: React.MouseEvent) => {
    e.stopPropagation()
    setEmail(demoUser.email)
    setPassword(demoUser.password)
    setActiveDemoEmail(demoUser.email)
    setError(null)
    setLoading(true)

    try {
      await login(demoUser.email, demoUser.password)
      toast.success(`Signed in as ${demoUser.role}`)
      router.push('/')
    } catch (err: any) {
      const authError = resolveAuthError(err, 'Sign in failed')
      setError(authError)
    } finally {
      setLoading(false)
    }
  }

  const handleSSOClick = (providerName: string) => {
    toast.info(`${providerName} SSO`, {
      description: 'Single Sign-On is available on the enterprise tier. Use email/password or select a demo account below.',
    })
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background text-foreground selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* ========================================================================= */}
      {/* LEFT COLUMN: Cinematic Enterprise Visual Telemetry Enclave (Desktop 50%) */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[52%] relative bg-slate-950 overflow-hidden flex-col justify-between p-8 xl:p-12 border-r border-border/40 select-none">
        {/* Ambient gradient background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header: TRIS brand */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 group w-fit">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold font-mono text-white tracking-tight">TRIS</span>
              <p className="text-[11px] text-slate-400 font-mono tracking-wide">Trust &amp; Risk Intelligence System</p>
            </div>
          </Link>
        </div>

        {/* Centerpiece: What TRIS Does */}
        <div className="relative z-10 my-auto py-8 space-y-8 max-w-md">
          <div className="space-y-4">
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Connect risk signals.<br />
              Prioritize exceptions.<br />
              Track action to resolution.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              TRIS brings financial, supplier, approval, and access-related information into one review workflow so a reviewer can understand why an exception needs attention, investigate it, document corrective action, close it with evidence, and identify recurrence.
            </p>
          </div>

          {/* 4 category icons — matching wireframe */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Financial Transactions', icon: FileSpreadsheet },
              { label: 'Supplier Information', icon: Building2 },
              { label: 'Approvals & Access', icon: CheckCircle2 },
              { label: 'Risk Cases & Investigations', icon: ShieldAlert },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs text-slate-300 font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-4 border-t border-slate-800/60 text-[11px] font-mono text-slate-500">
          <p>Evaluation environment · Synthetic test data only</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Enterprise Authentication Gateway Form (100% / Desktop 50%) */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 xl:w-[48%] flex flex-col justify-between p-4 sm:p-8 lg:p-12 xl:p-16 relative overflow-y-auto min-h-screen lg:min-h-0">
        {/* Ambient background accent for right pane */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Utility Header */}
        <div className="flex items-center justify-between w-full max-w-lg mx-auto pb-4">
          {/* Mobile-Only Brand Icon */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-base font-bold font-mono text-foreground">TRIS</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              v1.3
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <span>Secure sign-in</span>
          </div>

          {/* System Status Pill */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>

        {/* Main Authentication Card */}
        <div className="w-full max-w-lg mx-auto my-auto py-6 space-y-6 relative z-10">
          {/* Form Header */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
              Sign in to TRIS
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Enter your email and password to access your account.
            </p>
          </div>

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message Box */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">{error.title}</p>
                  <p>{error.message}</p>
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={loading}
                  autoFocus
                  className="h-11 text-xs sm:text-sm bg-card border-border pr-10 focus-visible:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={loading}
                  className="h-11 text-xs sm:text-sm bg-card border-border pr-10 focus-visible:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Primary Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center ml-1">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </>
              )}
            </Button>
          </form>

          {/* Evaluation Access Card - Single Primary Persona (Reviewer / Case Owner) */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-semibold text-foreground">
                  Evaluation Access
                </p>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  Primary Persona
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">Click to auto-fill</span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Use the primary evaluation persona to experience the end-to-end exception review journey:
            </p>

            <div
              onClick={() => selectDemoUser(PRIMARY_DEMO_USER)}
              className={`group p-3 rounded-xl border transition-all text-xs flex items-center justify-between gap-3 cursor-pointer select-none ${
                activeDemoEmail === PRIMARY_DEMO_USER.email
                  ? 'bg-primary/10 border-primary/50 text-foreground ring-1 ring-primary/30 shadow-xs'
                  : 'bg-card/70 border-border/80 hover:bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-xs text-foreground">
                      {PRIMARY_DEMO_USER.role}
                    </p>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {PRIMARY_DEMO_USER.email} · password123
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => quickLoginDemoUser(PRIMARY_DEMO_USER, e)}
                disabled={loading}
                title="Instant sign in as Risk Reviewer / Case Owner"
                className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <span>Sign in</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Trust & Legal Links */}
        <div className="w-full max-w-lg mx-auto pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <p>© 2026 TRIS Risk Intelligence Systems.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toast.info('Security policy documentation is available upon request.')}
              className="hover:text-foreground hover:underline"
            >
              Security Policy
            </button>
            <span>·</span>
            <button
              onClick={() => toast.info('Documentation available on request.')}
              className="hover:text-foreground hover:underline"
            >
              Documentation
            </button>
            <span>·</span>
            <button
              onClick={() => toast.info('Contact your system administrator for support.')}
              className="hover:text-foreground hover:underline"
            >
              Support
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal Dialog */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-foreground">Password Recovery</h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-mono px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please contact your system administrator to reset your password. For this evaluation environment, use the demo account credentials shown on the sign-in page.
            </p>
            <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs font-mono space-y-1">
              <p className="text-foreground font-semibold">Evaluation Access:</p>
              <p className="text-muted-foreground">Use a demo account from the sign-in page to explore TRIS.</p>
            </div>
            <Button
              className="w-full text-xs"
              onClick={() => setShowForgotModal(false)}
            >
              Return to Sign In
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
