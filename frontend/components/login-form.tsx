'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Cpu,
  Fingerprint,
} from 'lucide-react'

interface DemoUser {
  email: string
  role: string
  title: string
  password: string
  icon: React.ComponentType<{ className?: string }>
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'reviewer@tris.internal',
    role: 'Risk Reviewer',
    title: 'Financial Forensics Lead',
    password: 'password123',
    icon: UserCheck,
  },
  {
    email: 'verifier@tris.internal',
    role: 'Compliance Verifier',
    title: 'Independent Controls Auditor',
    password: 'password123',
    icon: Shield,
  },
  {
    email: 'sarah@company.com',
    role: 'CFO',
    title: 'Executive Financial Oversight',
    password: 'password',
    icon: Building,
  },
  {
    email: 'james@company.com',
    role: 'Procurement',
    title: 'Supplier Resilience & Vendor Oversight',
    password: 'password',
    icon: Building,
  },
  {
    email: 'admin@tris.internal',
    role: 'System Administrator',
    title: 'Full Platform Access & Engine',
    password: 'admin123',
    icon: KeyRound,
  },
]

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
      toast.error(authError.title, {
        description: authError.message,
      })
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
      toast.error(authError.title, {
        description: authError.message,
      })
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
        {/* Background Visual Asset with Subtle Parallax Zoom & Vignette */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/auth-hero-portrait.jpg"
            alt="TRIS Zero-Trust Risk Intelligence Operations"
            fill
            priority
            className="object-cover object-center opacity-60 scale-100 hover:scale-105 transition-transform duration-1000 ease-out"
          />
          {/* Multilayer Cyber Gradients & Vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/90" />
          {/* Subtle Cyber Grid Matrix Pattern */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Ambient Top Glow Orb */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/25 rounded-full blur-3xl pointer-events-none" />

        {/* Header Branding Overlay */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-mono text-white tracking-tight">TRIS</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary-foreground border border-primary/40 font-semibold tracking-wider">
                    v1.3 STUDIO
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono tracking-wide">
                  RISK INTELLIGENCE PLATFORM
                </p>
              </div>
            </Link>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 backdrop-blur-md text-[11px] font-mono text-slate-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="tracking-wide">SOC 2 & FIPS 140-3 COMPLIANT</span>
            </div>
          </div>
        </div>

        {/* Centerpiece: Value Proposition & Telemetry Glass Bento Card */}
        <div className="relative z-10 my-auto py-8 space-y-6 max-w-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ENTERPRISE RISK INTELLIGENCE</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Continuous risk intelligence for enterprise procurement.
            </h2>
            <p className="text-sm xl:text-base text-slate-300 leading-relaxed">
              Real-time analysis across SAP, Oracle, and invoice disbursement ledgers to prevent payment fraud and verify supplier integrity.
            </p>
          </div>

          {/* Double-Bezel Telemetry HUD Card */}
          <div className="rounded-2xl p-1 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
            <div className="rounded-[calc(1rem-1px)] bg-slate-950/85 p-5 space-y-4 border border-white/5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                  <Cpu className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-white">Platform Performance</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  SYNCED
                </span>
              </div>

              {/* 3 Metric Pillars */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Detection Precision</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">99.98%</p>
                  <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                    <span>↑</span> Zero false closures
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Analysis Latency</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">&lt; 12ms</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Real-time stream</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Risk Mitigated</p>
                  <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">$42.8M</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Total risk prevented</p>
                </div>
              </div>

              {/* Quote / Endorsement */}
              <div className="pt-2 flex items-start gap-3 border-t border-slate-800">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                  SC
                </div>
                <div>
                  <p className="text-xs italic text-slate-300 leading-snug">
                    &ldquo;TRIS replaced manual sampling with automated risk checks.
                    Every supplier anomaly is verified before payment.&rdquo;
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    <span className="text-slate-200 font-semibold">Sarah Chen</span> · Chief Financial Officer & Oversight Lead
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="relative z-10 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> SOC 2 Type II
            </span>
            <span>·</span>
            <span>256-bit AES Encryption</span>
            <span>·</span>
            <span>Role-Based Access</span>
            <span>·</span>
            <span>ISO 27001</span>
          </div>
          <p className="text-slate-400 text-[10px]">
            Authorized Access Only
          </p>
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Error Message Box */}
            {error && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">{error.title}</p>
                  <p>{error.message}</p>
                </div>
              </div>
            )}

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

          {/* Enterprise Single Sign-On (SSO) Section with Coming Soon Badges */}
          <div className="space-y-3 pt-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-xs text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSSOClick('Okta SAML')}
                className="group relative p-2.5 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 text-center transition-all flex flex-col items-center justify-center gap-1"
              >
                <span className="text-xs font-semibold text-foreground">Okta</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Coming Soon
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSSOClick('Microsoft Entra ID')}
                className="group relative p-2.5 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 text-center transition-all flex flex-col items-center justify-center gap-1"
              >
                <span className="text-xs font-semibold text-foreground">Entra ID</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Coming Soon
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSSOClick('Google SAML 2.0')}
                className="group relative p-2.5 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 text-center transition-all flex flex-col items-center justify-center gap-1"
              >
                <span className="text-xs font-semibold text-foreground">Google SSO</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Coming Soon
                </span>
              </button>
            </div>
          </div>

          {/* Demo Sandbox Persona Selector */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-semibold text-foreground">
                  Demo Sandbox Personas
                </p>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  Evaluation Mode
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">Click to auto-fill</span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Select any role to populate credentials and test segregation of duties:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_USERS.map((demoUser) => {
                const Icon = demoUser.icon
                const isCurrent = activeDemoEmail === demoUser.email

                return (
                  <div
                    key={demoUser.email}
                    onClick={() => selectDemoUser(demoUser)}
                    className={`group p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-primary/10 border-primary/50 text-foreground ring-1 ring-primary/30 shadow-xs'
                        : 'bg-card/70 border-border/80 hover:bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isCurrent
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted/80 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-xs text-foreground truncate">
                            {demoUser.role}
                          </p>
                          {isCurrent && (
                            <span className="text-[8px] font-mono px-1 rounded bg-primary/20 text-primary font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{demoUser.title}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => quickLoginDemoUser(demoUser, e)}
                      disabled={loading}
                      title={`Instant sign in as ${demoUser.role}`}
                      className="shrink-0 p-1.5 rounded-md hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors text-[10px] font-medium hidden group-hover:flex items-center gap-0.5"
                    >
                      <span>Sign in</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bottom Trust & Legal Links */}
        <div className="w-full max-w-lg mx-auto pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <p>© 2026 TRIS Risk Intelligence Systems.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toast.info('Enterprise Security SLA: 99.99% with SOC 2 Type II attestation.')}
              className="hover:text-foreground hover:underline"
            >
              Security Policy
            </button>
            <span>·</span>
            <button
              onClick={() => toast.info('Deterministic Forensic Engine Documentation: v1.3.4')}
              className="hover:text-foreground hover:underline"
            >
              Compliance Spec
            </button>
            <span>·</span>
            <button
              onClick={() => toast.info('Contact TRIS Support: security-desk@tris.internal')}
              className="hover:text-foreground hover:underline"
            >
              Support Desk
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
              In accordance with Zero-Trust Security Policy, passwords cannot be reset via insecure channels.
              Please contact your organizational System Administrator or submit a ticket to the Security Operations Center.
            </p>
            <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs font-mono space-y-1">
              <p className="text-foreground font-semibold">Emergency SOC Desk:</p>
              <p className="text-primary">security-operations@tris.internal</p>
              <p className="text-muted-foreground">PGP Key ID: 0x9B42E7FA18C</p>
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
