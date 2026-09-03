'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { api, RuleConfig, DEFAULT_RULES_METADATA } from '@/lib/api'
import { toast } from 'sonner'
import {
  Building2,
  Shield,
  Lock,
  Sliders,
  Database,
  Key,
  FileText,
  Award,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Smartphone,
  Laptop,
  Globe,
  Download,
  Plus,
  Trash2,
  Zap,
  Server,
  QrCode,
  Layers,
  Sparkles,
  UserCheck,
} from 'lucide-react'

// Clean, user-friendly Coming Soon badge
function ComingSoonBadge({ label = 'Coming Soon' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {label}
    </span>
  )
}

interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  created: string
  lastUsed: string
}

interface ActiveSession {
  id: string
  device: string
  browser: string
  location: string
  ip: string
  lastActive: string
  isCurrent: boolean
}

export default function SettingsPage() {
  const { user } = useAuth()

  // Organization tab states
  const [orgName, setOrgName] = useState('Acme Industrial Manufacturing Corp')
  const [workspaceDomain, setWorkspaceDomain] = useState('acme-industrial.tris.internal')
  const [contactEmail, setContactEmail] = useState(user?.email || 'security-lead@acme-industrial.com')
  const [timezone, setTimezone] = useState('America/New_York')
  const [copiedTenant, setCopiedTenant] = useState(false)

  // Security tab states
  const [inactivityTimeout, setInactivityTimeout] = useState('30m')
  const [mfaEnabled, setMfaEnabled] = useState(true)
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [enforceMfaAll, setEnforceMfaAll] = useState(true)
  const [sessions, setSessions] = useState<ActiveSession[]>([
    {
      id: 'sess_1',
      device: 'MacBook Pro 16"',
      browser: 'Chrome · macOS',
      location: 'New York, US',
      ip: '198.51.100.24',
      lastActive: 'Active now',
      isCurrent: true,
    },
    {
      id: 'sess_2',
      device: 'ThinkPad P1',
      browser: 'Edge · Windows 11',
      location: 'Frankfurt, Germany',
      ip: '194.109.12.89',
      lastActive: '42 minutes ago',
      isCurrent: false,
    },
    {
      id: 'sess_3',
      device: 'iPhone 16 Pro',
      browser: 'Safari · iOS',
      location: 'New York, US',
      ip: '172.56.42.11',
      lastActive: '3 hours ago',
      isCurrent: false,
    },
  ])

  // Rules Engine state
  const [rules, setRules] = useState<RuleConfig[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [updatingRuleCode, setUpdatingRuleCode] = useState<string | null>(null)
  const [autoFreezeDisbursements, setAutoFreezeDisbursements] = useState(true)
  const [dualSignoffRequired, setDualSignoffRequired] = useState(true)

  // Integrations tab states
  const [sapConnected, setSapConnected] = useState(true)
  const [oracleConnected, setOracleConnected] = useState(true)
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00/B00/TRIS_ALERTS')

  // API Keys tab states
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([
    {
      id: 'key_1',
      name: 'SAP Invoice Ingestion Pipeline',
      keyPrefix: 'tris_live_9f82...c01a',
      scopes: ['cases:read', 'cases:write', 'suppliers:ingest'],
      created: 'Jan 14, 2026',
      lastUsed: 'Just now (12 req/min)',
    },
    {
      id: 'key_2',
      name: 'Security Audit Forwarder',
      keyPrefix: 'tris_live_3b71...a49d',
      scopes: ['audit:read', 'telemetry:stream'],
      created: 'Feb 02, 2026',
      lastUsed: '3 mins ago',
    },
  ])
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['cases:read'])

  // Fetch detection rules from API
  useEffect(() => {
    let mounted = true
    api.getRules()
      .then((data) => {
        if (mounted) {
          setRules(data)
          setRulesLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          const fallbackRules: RuleConfig[] = Object.entries(DEFAULT_RULES_METADATA).map(([code, meta]) => ({
            rule_code: code,
            name: meta.name,
            description: meta.description,
            weight: meta.weight,
            threshold_params: code === 'R-001' ? { multiplier: 2.0 } : {},
            rule_version: meta.version,
            is_active: true,
            updated_at: new Date().toISOString(),
          }))
          setRules(fallbackRules)
          setRulesLoading(false)
        }
      })
    return () => { mounted = false }
  }, [])

  const handleCopyTenant = () => {
    navigator.clipboard.writeText('ten_acme_ind_9f82a17c')
    setCopiedTenant(true)
    toast.success('Workspace ID copied to clipboard')
    setTimeout(() => setCopiedTenant(false), 2000)
  }

  const handleSaveGeneral = () => {
    toast.success('Settings saved successfully')
  }

  const handleRevokeSession = (sessionId: string) => {
    setSessions(sessions.filter((s) => s.id !== sessionId))
    toast.success('Session signed out successfully')
  }

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    const randomSuffix = Math.random().toString(36).substring(2, 6)
    const newKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      keyPrefix: `tris_live_${randomSuffix}...${randomSuffix.split('').reverse().join('')}`,
      scopes: selectedScopes,
      created: 'Just now',
      lastUsed: 'Never',
    }

    setApiKeys([newKey, ...apiKeys])
    setShowNewKeyModal(false)
    setNewKeyName('')
    toast.success('API key created', {
      description: `"${newKey.name}" is now ready to use.`,
    })
  }

  const handleRevokeApiKey = (keyId: string, keyName: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== keyId))
    toast.success('API key deleted', {
      description: `"${keyName}" has been deactivated.`,
    })
  }

  const handleUpdateRuleWeight = async (ruleCode: string, newWeight: number) => {
    setUpdatingRuleCode(ruleCode)
    try {
      const updated = await api.updateRule(ruleCode, { weight: newWeight })
      setRules((prev) => prev.map((r) => (r.rule_code === ruleCode ? updated : r)))
      toast.success(`Rule ${ruleCode} updated`, {
        description: `Weight adjusted to ${newWeight} points.`,
      })
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.rule_code === ruleCode ? { ...r, weight: newWeight, rule_version: r.rule_version + 1 } : r))
      )
      toast.success(`Rule ${ruleCode} updated`, {
        description: `Weight adjusted to ${newWeight} points.`,
      })
    } finally {
      setUpdatingRuleCode(null)
    }
  }

  const handleToggleRuleActive = async (ruleCode: string, currentActive: boolean) => {
    setUpdatingRuleCode(ruleCode)
    try {
      const updated = await api.updateRule(ruleCode, { is_active: !currentActive })
      setRules((prev) => prev.map((r) => (r.rule_code === ruleCode ? updated : r)))
      toast.success(`Rule ${ruleCode} ${!currentActive ? 'enabled' : 'disabled'}`)
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.rule_code === ruleCode ? { ...r, is_active: !currentActive } : r))
      )
      toast.success(`Rule ${ruleCode} ${!currentActive ? 'enabled' : 'disabled'}`)
    } finally {
      setUpdatingRuleCode(null)
    }
  }

  const handleExportCompliance = () => {
    toast.success('Downloading compliance report bundle (.zip)')
  }

  return (
    <DashboardLayout
      title="Settings"
      description="Manage your organization profile, security preferences, detection rules, and integrations."
    >
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* ========================================================================= */}
        {/* TENANT HEADER & SAVE ACTIONS */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground truncate">{orgName}</h2>
                <Badge variant="outline" className="text-[10px] font-medium bg-primary/10 text-primary border-primary/30">
                  Enterprise Plan
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  Workspace ID: <span className="font-mono text-foreground">ten_acme_ind_9f82a17c</span>
                  <button
                    onClick={handleCopyTenant}
                    className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                    title="Copy Workspace ID"
                  >
                    {copiedTenant ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  All Systems Operational
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info('Refreshing rules and settings...')
                api.getRules().then((data) => {
                  setRules(data)
                  toast.success('Rules refreshed successfully')
                })
              }}
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleSaveGeneral}
              className="text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SETTINGS TABS */}
        {/* ========================================================================= */}
        <Tabs defaultValue="general" className="space-y-6">
          <div className="border-b border-border/80 pb-px overflow-x-auto">
            <TabsList className="bg-muted/40 p-1 rounded-xl h-auto gap-1 border border-border/60 flex-nowrap w-max min-w-full sm:min-w-0">
              <TabsTrigger value="general" className="gap-2 text-xs py-2 px-3 data-[state=active]:bg-card shadow-xs">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>Organization & Profile</span>
              </TabsTrigger>
              <TabsTrigger value="risk-engine" className="gap-2 text-xs py-2 px-3 data-[state=active]:bg-card shadow-xs">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span>Detection Rules</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2 text-xs py-2 px-3 data-[state=active]:bg-card shadow-xs">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>Security & Sessions</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="gap-2 text-xs py-2 px-3 data-[state=active]:bg-card shadow-xs">
                <Database className="w-3.5 h-3.5 text-primary" />
                <span>Integrations</span>
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="gap-2 text-xs py-2 px-3 data-[state=active]:bg-card shadow-xs">
                <Key className="w-3.5 h-3.5 text-primary" />
                <span>API Keys</span>
              </TabsTrigger>
              <TabsTrigger value="audit-siem" className="gap-2 text-xs py-2 px-3 data-[state=active]:bg-card shadow-xs">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Audit Logs</span>
              </TabsTrigger>
              <TabsTrigger value="licensing" className="gap-2 text-xs py-2 px-3 data-[state=active]:bg-card shadow-xs">
                <Award className="w-3.5 h-3.5 text-primary" />
                <span>Plan & Licenses</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: ORGANIZATION & USER PROFILE */}
          {/* ========================================================================= */}
          <TabsContent value="general" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* User Profile Card */}
                <Card className="border-border shadow-xs bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-primary" />
                        Account Profile
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                        Signed In
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Your personal account details and permissions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Full Name</p>
                        <p className="font-semibold text-sm text-foreground">{user?.name || 'Risk Reviewer'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Email Address</p>
                        <p className="font-semibold text-sm text-foreground">{user?.email || 'reviewer@tris.internal'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Role</p>
                        <p className="font-semibold text-sm text-primary uppercase">{user?.role || 'Reviewer'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Department</p>
                        <p className="font-semibold text-sm text-foreground">{user?.department || 'Finance & Compliance'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Organization Details */}
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      Organization Profile
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Manage company name, workspace subdomain, and primary contact information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <Label htmlFor="org-name" className="text-xs font-semibold">Company Name</Label>
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="h-10 text-xs bg-background"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="domain" className="text-xs font-semibold">Workspace Domain</Label>
                        <Input
                          id="domain"
                          value={workspaceDomain}
                          onChange={(e) => setWorkspaceDomain(e.target.value)}
                          className="h-10 text-xs bg-background font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-email" className="text-xs font-semibold">Primary Contact Email</Label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="h-10 text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Timezone</Label>
                        <Select value={timezone} onValueChange={setTimezone}>
                          <SelectTrigger className="h-10 text-xs w-full bg-background">
                            <SelectValue placeholder="Select Timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/New_York">Eastern Time (US / New York)</SelectItem>
                            <SelectItem value="America/Chicago">Central Time (US / Chicago)</SelectItem>
                            <SelectItem value="Europe/London">London (GMT / BST)</SelectItem>
                            <SelectItem value="Europe/Berlin">Frankfurt / Berlin (CET)</SelectItem>
                            <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Date Format</Label>
                        <Select defaultValue="iso8601">
                          <SelectTrigger className="h-10 text-xs w-full bg-background">
                            <SelectValue placeholder="Standard" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="iso8601">YYYY-MM-DD (2026-09-02)</SelectItem>
                            <SelectItem value="us_rfc">MM/DD/YYYY (09/02/2026)</SelectItem>
                            <SelectItem value="epoch">DD/MM/YYYY (02/09/2026)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Domain (Coming Soon) */}
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">Custom Domain (CNAME)</CardTitle>
                        <ComingSoonBadge />
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Use your own company domain (e.g. <code className="px-1 py-0.5 bg-muted rounded text-[11px]">risk.yourcompany.com</code>) with automatic SSL certificate management.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Input
                        disabled
                        placeholder="risk.yourcompany.com"
                        className="h-9 text-xs bg-muted/30 max-w-sm"
                      />
                      <Button disabled variant="secondary" size="sm" className="text-xs h-9">
                        Verify Domain
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Data Residency & Branding */}
              <div className="space-y-6">
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      Data Residency
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Choose where your transaction and audit data is stored.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          US East (N. Virginia)
                        </span>
                        <Badge variant="secondary" className="text-[9px]">Active</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Primary secure cloud storage with multi-zone high availability.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between opacity-80">
                      <div>
                        <p className="font-medium text-foreground">EU Central (Frankfurt)</p>
                        <p className="text-[10px] text-muted-foreground">European data privacy compliance</p>
                      </div>
                      <ComingSoonBadge />
                    </div>

                    <div className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between opacity-80">
                      <div>
                        <p className="font-medium text-foreground">Asia Pacific (Tokyo)</p>
                        <p className="text-[10px] text-muted-foreground">Asia-Pacific regional storage</p>
                      </div>
                      <ComingSoonBadge />
                    </div>
                  </CardContent>
                </Card>

                {/* Branding Card */}
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Custom Branding</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Add your company logo and brand colors.
                      </CardDescription>
                    </div>
                    <ComingSoonBadge />
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="p-4 rounded-xl border border-dashed border-border/80 text-center space-y-2">
                      <Layers className="w-6 h-6 mx-auto text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">
                        Custom logo upload and interface theme customization will be available in an upcoming update.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: DETECTION RULES */}
          {/* ========================================================================= */}
          <TabsContent value="risk-engine" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-primary" />
                          Detection Rules
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Adjust scoring weights and enable or disable individual fraud and compliance rules.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 text-[10px] gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    {rulesLoading ? (
                      <div className="space-y-2 py-4">
                        <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
                        <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
                        <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
                      </div>
                    ) : (
                      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                        {rules.map((r) => (
                          <div
                            key={r.rule_code}
                            className="p-3.5 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:bg-muted/15"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-primary text-xs">{r.rule_code}</span>
                                <span className="font-semibold text-foreground text-xs">{r.name}</span>
                                <Badge variant="outline" className="text-[9px]">
                                  v{r.rule_version}
                                </Badge>
                                {!r.is_active && (
                                  <Badge variant="secondary" className="text-[9px] text-muted-foreground">
                                    Disabled
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground text-[11px] leading-snug">{r.description}</p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground font-medium">Weight:</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={r.weight}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    setRules((prev) =>
                                      prev.map((item) => (item.rule_code === r.rule_code ? { ...item, weight: val } : item))
                                    )
                                  }}
                                  onBlur={(e) => handleUpdateRuleWeight(r.rule_code, parseInt(e.target.value) || 0)}
                                  disabled={updatingRuleCode === r.rule_code}
                                  className="w-16 h-8 text-xs text-center"
                                />
                                <span className="text-[10px] text-muted-foreground">pts</span>
                              </div>

                              <Switch
                                checked={r.is_active}
                                onCheckedChange={() => handleToggleRuleActive(r.rule_code, r.is_active)}
                                disabled={updatingRuleCode === r.rule_code}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Operational Safety Gates */}
                    <div className="pt-2 space-y-3">
                      <p className="text-xs font-semibold text-foreground">
                        Automated Protection Actions
                      </p>

                      <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
                        <div className="space-y-0.5 pr-4">
                          <p className="font-semibold text-foreground text-xs">Automated Payment Hold</p>
                          <p className="text-muted-foreground text-[11px]">
                            Automatically pause payments for invoice batches with high composite risk scores (above 90).
                          </p>
                        </div>
                        <Switch
                          checked={autoFreezeDisbursements}
                          onCheckedChange={(checked) => {
                            setAutoFreezeDisbursements(checked)
                            toast.success(checked ? 'Automated payment holds enabled' : 'Automated payment holds disabled')
                          }}
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
                        <div className="space-y-0.5 pr-4">
                          <p className="font-semibold text-foreground text-xs">Require Two-Person Verification</p>
                          <p className="text-muted-foreground text-[11px]">
                            Require independent verification from both a Reviewer and an Auditor before closing high-risk cases.
                          </p>
                        </div>
                        <Switch
                          checked={dualSignoffRequired}
                          onCheckedChange={(checked) => {
                            setDualSignoffRequired(checked)
                            toast.success(checked ? 'Dual verification required for closure' : 'Single person closure permitted')
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Advanced AI Models */}
              <div className="space-y-6">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Advanced AI Risk Models
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Deep learning models for detecting complex multi-vendor shell schemes.
                      </CardDescription>
                    </div>
                    <ComingSoonBadge />
                  </CardHeader>
                  <CardContent className="space-y-3.5 text-xs">
                    <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Statistical Engine</span>
                        <Badge variant="secondary" className="text-[9px]">Standard</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Real-time historical baselines, duplicate detection, and approval compliance checks.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 opacity-90">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Graph Neural Network</span>
                        <ComingSoonBadge label="Beta" />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Automatic beneficial ownership mapping, shell vendor detection, and cyclic transaction discovery.
                      </p>
                    </div>

                    <Button
                      disabled
                      variant="outline"
                      className="w-full text-xs h-9"
                    >
                      Request Beta Access
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: SECURITY & SESSIONS */}
          {/* ========================================================================= */}
          <TabsContent value="security" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      Security & Two-Factor Authentication
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Configure two-step verification, auto-lock timeouts, and sign-in requirements.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 text-xs">
                    {/* TOTP MFA Switch */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border">
                      <div className="space-y-0.5 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">Two-Factor Authentication (Authenticator App)</p>
                          <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            Enabled
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          Require a six-digit verification code from your authenticator app (1Password, Google Authenticator) when signing in.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowMfaModal(true)}
                          className="text-xs h-8 gap-1"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Setup QR
                        </Button>
                        <Switch
                          checked={mfaEnabled}
                          onCheckedChange={(checked) => {
                            setMfaEnabled(checked)
                            toast.success(checked ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled')
                          }}
                        />
                      </div>
                    </div>

                    {/* Hardware Keys (Coming Soon) */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/25 border border-border/70">
                      <div className="space-y-0.5 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">Hardware Security Keys (YubiKey / Passkeys)</p>
                          <ComingSoonBadge />
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          Sign in with a physical security key (YubiKey) or biometric passkey (Touch ID, Windows Hello).
                        </p>
                      </div>
                      <Button disabled variant="secondary" size="sm" className="text-xs h-8 shrink-0">
                        Register Key
                      </Button>
                    </div>

                    {/* Inactivity Auto-Lock */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">Auto-Lock After Inactivity</p>
                        <p className="text-muted-foreground text-[11px]">
                          Automatically lock the dashboard when no mouse or keyboard activity is detected.
                        </p>
                      </div>
                      <Select value={inactivityTimeout} onValueChange={(val) => {
                        setInactivityTimeout(val)
                        toast.success(`Auto-lock set to ${val}`)
                      }}>
                        <SelectTrigger className="h-9 text-xs w-32 bg-background">
                          <SelectValue placeholder="Timeout" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15m">15 minutes</SelectItem>
                          <SelectItem value="30m">30 minutes</SelectItem>
                          <SelectItem value="1h">1 hour</SelectItem>
                          <SelectItem value="4h">4 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Mandatory MFA */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border">
                      <div className="space-y-0.5 pr-4">
                        <p className="font-semibold text-foreground">Require Two-Factor for All Team Members</p>
                        <p className="text-muted-foreground text-[11px]">
                          All users must configure two-factor authentication before they can access the workspace.
                        </p>
                      </div>
                      <Switch
                        checked={enforceMfaAll}
                        onCheckedChange={(checked) => {
                          setEnforceMfaAll(checked)
                          toast.success(checked ? 'Two-factor now required for all users' : 'Optional two-factor enabled')
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Active Sessions */}
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-primary" />
                        Active Sessions ({sessions.length})
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Devices currently signed in to your account.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSessions(sessions.filter((s) => s.isCurrent))
                        toast.success('Signed out of all other devices')
                      }}
                      className="text-xs h-8 text-destructive hover:bg-destructive/10"
                    >
                      Sign Out Others
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="p-3 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            {sess.device.includes('iPhone') ? (
                              <Smartphone className="w-4 h-4" />
                            ) : (
                              <Laptop className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-xs">{sess.device}</p>
                              {sess.isCurrent && (
                                <Badge variant="secondary" className="text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                                  Current Device
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {sess.browser} · <span className="font-mono">{sess.ip}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground/75 mt-0.5">
                              {sess.location} · {sess.lastActive}
                            </p>
                          </div>
                        </div>

                        {!sess.isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeSession(sess.id)}
                            className="text-xs h-8 text-destructive hover:bg-destructive/10"
                          >
                            Sign Out
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Single Sign-On (SSO) */}
              <div className="space-y-6">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary" />
                        Single Sign-On (SSO)
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Log in using your corporate identity provider.
                      </CardDescription>
                    </div>
                    <ComingSoonBadge />
                  </CardHeader>
                  <CardContent className="space-y-3.5 text-xs">
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      Connect TRIS directly to Okta, Microsoft Entra, or Google Workspace to manage user logins in one place.
                    </p>

                    <div className="space-y-2">
                      {[
                        { name: 'Okta', type: 'SAML 2.0 & SCIM' },
                        { name: 'Microsoft Entra ID', type: 'Azure AD SSO' },
                        { name: 'Google Workspace', type: 'Google Enterprise SSO' },
                      ].map((idp) => (
                        <div
                          key={idp.name}
                          className="p-2.5 rounded-lg border border-border/80 bg-card/60 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-xs text-foreground">{idp.name}</p>
                            <p className="text-[10px] text-muted-foreground">{idp.type}</p>
                          </div>
                          <ComingSoonBadge />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 4: INTEGRATIONS */}
          {/* ========================================================================= */}
          <TabsContent value="integrations" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ERP Systems */}
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    ERP & Accounting Systems
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Connect your financial systems to sync invoices, suppliers, and payment holds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5 text-xs">
                  {/* SAP */}
                  <div className="p-3.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-xs">SAP S/4HANA</p>
                        <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          Connected
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Last synced 4 minutes ago · 1,420 invoices processed today.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSapConnected(!sapConnected)
                        toast.info(sapConnected ? 'SAP sync paused' : 'SAP sync resumed')
                      }}
                      className="text-xs h-8 self-end sm:self-auto shrink-0"
                    >
                      {sapConnected ? 'Configure' : 'Reconnect'}
                    </Button>
                  </div>

                  {/* Oracle */}
                  <div className="p-3.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-xs">Oracle NetSuite</p>
                        <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          Connected
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Continuous automatic sync active.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOracleConnected(!oracleConnected)
                        toast.info(oracleConnected ? 'Oracle sync paused' : 'Oracle sync resumed')
                      }}
                      className="text-xs h-8 self-end sm:self-auto shrink-0"
                    >
                      {oracleConnected ? 'Configure' : 'Reconnect'}
                    </Button>
                  </div>

                  {/* Workday (Coming Soon) */}
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 flex items-center justify-between opacity-85">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-xs">Workday Financials</p>
                        <ComingSoonBadge />
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Accounts payable integration and supplier master sync.
                      </p>
                    </div>
                    <Button disabled variant="secondary" size="sm" className="text-xs h-8">
                      Connect
                    </Button>
                  </div>

                  {/* Microsoft Dynamics (Coming Soon) */}
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 flex items-center justify-between opacity-85">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-xs">Microsoft Dynamics 365</p>
                        <ComingSoonBadge />
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        General ledger and invoice workflow connector.
                      </p>
                    </div>
                    <Button disabled variant="secondary" size="sm" className="text-xs h-8">
                      Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Alert Channels */}
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Alert Notifications
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Send high-risk alerts directly to your team communication channels.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {/* Slack */}
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground text-xs">Slack Channel Alerts</p>
                      <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Active (#fraud-alerts)
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={slackWebhook}
                        onChange={(e) => setSlackWebhook(e.target.value)}
                        className="h-9 text-xs bg-background font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => toast.success('Test alert sent to Slack #fraud-alerts')}
                        className="text-xs h-9 shrink-0"
                      >
                        Send Test
                      </Button>
                    </div>
                  </div>

                  {/* PagerDuty */}
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 flex items-center justify-between opacity-85">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-xs">PagerDuty On-Call Alerts</p>
                        <ComingSoonBadge />
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Page on-call investigators when critical payment risks are flagged.
                      </p>
                    </div>
                    <Button disabled variant="secondary" size="sm" className="text-xs h-8">
                      Configure
                    </Button>
                  </div>

                  {/* Microsoft Teams */}
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 flex items-center justify-between opacity-85">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-xs">Microsoft Teams</p>
                        <ComingSoonBadge />
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Deliver real-time notifications to Teams channels.
                      </p>
                    </div>
                    <Button disabled variant="secondary" size="sm" className="text-xs h-8">
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 5: API KEYS */}
          {/* ========================================================================= */}
          <TabsContent value="api-keys" className="space-y-6 outline-none">
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    API Keys
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Create and manage API keys to connect external tools and custom scripts.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowNewKeyModal(true)}
                  className="text-xs h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Key
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {/* Usage meter */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground text-xs">Monthly API Calls</p>
                    <p className="text-muted-foreground text-[11px]">
                      14,250 of 100,000 requests used (14.2%).
                    </p>
                  </div>
                  <div className="w-full sm:w-48 bg-muted rounded-full h-2 overflow-hidden border border-border">
                    <div className="bg-primary h-full w-[14.2%]" />
                  </div>
                </div>

                {/* API Keys Table */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-12 bg-muted/50 p-3 text-[11px] uppercase text-muted-foreground font-semibold border-b border-border">
                    <div className="col-span-4">Key Name</div>
                    <div className="col-span-3">Permissions</div>
                    <div className="col-span-2">Created</div>
                    <div className="col-span-2">Last Activity</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  <div className="divide-y divide-border">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="grid grid-cols-12 p-3 items-center text-xs">
                        <div className="col-span-4 space-y-0.5">
                          <p className="font-semibold text-foreground">{key.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <code>{key.keyPrefix}</code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(key.keyPrefix)
                                toast.success('API key copied to clipboard')
                              }}
                              className="hover:text-foreground text-muted-foreground"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </p>
                        </div>
                        <div className="col-span-3 flex flex-wrap gap-1">
                          {key.scopes.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                        <div className="col-span-2 text-muted-foreground text-[11px]">{key.created}</div>
                        <div className="col-span-2 text-muted-foreground text-[11px]">{key.lastUsed}</div>
                        <div className="col-span-1 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeApiKey(key.id, key.name)}
                            className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                            title="Delete API Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GraphQL API (Coming Soon) */}
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 flex items-center justify-between opacity-85 mt-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-xs">GraphQL API</p>
                      <ComingSoonBadge />
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Query cases, invoices, and risk indicators with custom GraphQL endpoints.
                    </p>
                  </div>
                  <Button disabled variant="secondary" size="sm" className="text-xs h-8">
                    View Docs
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 6: AUDIT LOGS */}
          {/* ========================================================================= */}
          <TabsContent value="audit-siem" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Audit Log
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Recent security, case updates, and administrative actions.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleExportCompliance}
                      className="text-xs h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Logs (.zip)
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="grid grid-cols-12 bg-muted/50 p-2.5 text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">
                        <div className="col-span-4">Date & Time</div>
                        <div className="col-span-4">User</div>
                        <div className="col-span-4">Action</div>
                      </div>

                      <div className="divide-y divide-border text-[11px]">
                        {[
                          { time: 'Today at 3:42 PM', actor: 'reviewer@tris.internal', action: 'Evidence attached to Case #001' },
                          { time: 'Today at 2:18 PM', actor: 'verifier@tris.internal', action: 'Case #001 verified and closed' },
                          { time: 'Today at 12:05 PM', actor: 'admin@tris.internal', action: 'Rule weight adjusted' },
                          { time: 'Today at 9:31 AM', actor: 'SAP Integration', action: 'Synced 1,420 new invoices' },
                        ].map((log, i) => (
                          <div key={i} className="grid grid-cols-12 p-2.5 items-center">
                            <div className="col-span-4 text-muted-foreground">{log.time}</div>
                            <div className="col-span-4 text-foreground font-medium truncate">{log.actor}</div>
                            <div className="col-span-4 text-primary">{log.action}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: SIEM Export */}
              <div className="space-y-6">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Server className="w-4 h-4 text-primary" />
                        SIEM Integrations
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Stream audit events to your company security system.
                      </CardDescription>
                    </div>
                    <ComingSoonBadge />
                  </CardHeader>
                  <CardContent className="space-y-3.5 text-xs">
                    <div className="space-y-2">
                      {[
                        { name: 'Splunk Cloud', desc: 'Real-time event streaming' },
                        { name: 'Datadog Logs', desc: 'Security log forwarding' },
                        { name: 'AWS S3 Cloud Storage', desc: 'Long-term audit archiving' },
                        { name: 'Microsoft Sentinel', desc: 'Azure security center sync' },
                      ].map((siem) => (
                        <div
                          key={siem.name}
                          className="p-2.5 rounded-lg border border-border/80 bg-card/60 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-xs text-foreground">{siem.name}</p>
                            <p className="text-[10px] text-muted-foreground">{siem.desc}</p>
                          </div>
                          <ComingSoonBadge />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 7: PLAN & LICENSES */}
          {/* ========================================================================= */}
          <TabsContent value="licensing" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border shadow-xs">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary" />
                        Enterprise Plan
                      </CardTitle>
                      <Badge className="bg-primary text-primary-foreground text-[10px]">
                        Active · 99.99% Uptime SLA
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Enterprise tier with dedicated high-availability hosting and priority support.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-card border border-border">
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Team Seats</p>
                        <p className="text-xl font-bold font-mono text-foreground mt-0.5">14 / 50</p>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                          <div className="bg-primary h-full w-[28%]" />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-card border border-border">
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Audit Storage</p>
                        <p className="text-xl font-bold font-mono text-foreground mt-0.5">2.4 TB / 10 TB</p>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[24%]" />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-card border border-border">
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Contract Period</p>
                        <p className="text-xl font-bold font-mono text-foreground mt-0.5">2026 – 2028</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Multi-year Enterprise</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground text-xs">Dedicated Account Manager</p>
                        <p className="text-muted-foreground text-[11px]">
                          Marcus Vance · Principal Risk Solutions Architect
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info('Emailing Marcus Vance (Account Manager)')}
                        className="text-xs h-8 shrink-0"
                      >
                        Contact Account Manager
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Upgrade / Manage Plan */}
              <div className="space-y-6">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Manage Subscription</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Add more user seats or expand data storage limits.
                      </CardDescription>
                    </div>
                    <ComingSoonBadge />
                  </CardHeader>
                  <CardContent className="space-y-3.5 text-xs">
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Self-serve seat expansion and online invoice management will be available in an upcoming update.
                    </p>
                    <Button disabled variant="outline" className="w-full text-xs h-9">
                      Manage Billing
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SETUP AUTHENTICATOR APP */}
      {/* ========================================================================= */}
      {showMfaModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-foreground">Set Up Authenticator App</h3>
              </div>
              <button
                onClick={() => setShowMfaModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-mono px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Scan this QR code with your authenticator app (such as Google Authenticator, 1Password, or Microsoft Authenticator).
            </p>

            <div className="w-44 h-44 mx-auto rounded-xl bg-white p-3 border-2 border-primary/40 flex flex-col items-center justify-center shadow-md">
              <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <QrCode className="w-28 h-28 text-white" />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-center text-[11px]">
              <p className="text-muted-foreground">Can&apos;t scan? Use this setup code:</p>
              <p className="text-primary font-bold font-mono select-all tracking-wider">JBSWY3DPEHPK3PXP</p>
            </div>

            <Button
              className="w-full text-xs h-9"
              onClick={() => {
                setShowMfaModal(false)
                toast.success('Two-factor authentication verified and enabled')
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE API KEY */}
      {/* ========================================================================= */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateApiKey}
            className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Create API Key</h3>
                  <p className="text-[11px] text-muted-foreground">Generate a key for API access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewKeyModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-mono px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Accounting Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-2 text-xs">
              <Label>Permissions</Label>
              <div className="space-y-1.5 border border-border rounded-xl p-3 bg-muted/20">
                {[
                  { id: 'cases:read', label: 'Read Cases — View risk alerts and case details' },
                  { id: 'cases:write', label: 'Write Cases — Create and update case records' },
                  { id: 'suppliers:ingest', label: 'Upload Data — Ingest supplier invoices and transactions' },
                  { id: 'quarantine:execute', label: 'Payment Holds — Trigger automated payment holds' },
                ].map((scope) => {
                  const isChecked = selectedScopes.includes(scope.id)
                  return (
                    <label key={scope.id} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedScopes(selectedScopes.filter((s) => s !== scope.id))
                          } else {
                            setSelectedScopes([...selectedScopes, scope.id])
                          }
                        }}
                        className="rounded border-border text-primary"
                      />
                      <span className="text-[11px] text-foreground">{scope.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewKeyModal(false)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Create Key
              </Button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  )
}
