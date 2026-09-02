'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import {
  User,
  ShieldCheck,
  History,
  Settings,
  Database,
  CheckSquare,
  LogOut,
  ChevronRight,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'

export function UserNav() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const handleSignOut = async () => {
    setOpen(false)
    logout()
    router.push('/login')
  }

  // Generate clean initials from user name
  const initials = user.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  const roleLabels: Record<string, { label: string; class: string }> = {
    cfo: { label: 'Chief Risk Officer / CFO', class: 'bg-primary/10 text-primary' },
    admin: { label: 'System Administrator', class: 'bg-primary/10 text-primary' },
    compliance: { label: 'Compliance Verifier', class: 'bg-success/10 text-success' },
    security: { label: 'Security & Forensics', class: 'bg-warning/10 text-warning' },
    procurement: { label: 'Procurement Specialist', class: 'bg-muted text-muted-foreground' },
  }

  const roleInfo = roleLabels[user.role?.toLowerCase()] || {
    label: `${user.role} Member`,
    class: 'bg-muted text-muted-foreground',
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-full ring-2 ring-primary/20 hover:ring-primary/50 transition-all cursor-pointer bg-gradient-to-tr from-primary/20 via-primary/10 to-primary/30 text-primary font-bold text-xs select-none shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={`${user.name} (${user.role})`}
          aria-label="User Account Menu"
        >
          <span>{initials}</span>
          {/* Active green status indicator dot */}
          <span className="w-2.5 h-2.5 rounded-full bg-success border-2 border-background absolute -bottom-0.5 -right-0.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 rounded-2xl border-0 shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] dark:bg-[#16181f] overflow-hidden"
      >
        {/* User Identity Header Card */}
        <div className="p-4 pb-3.5 bg-muted/20 dark:bg-muted/10 border-b border-border/30 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/30 to-primary/10 text-primary font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground truncate leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                {user.email || `${user.id.toLowerCase()}@tris.internal`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ${roleInfo.class}`}>
              {roleInfo.label}
            </span>
            {user.department && (
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {user.department}
              </span>
            )}
          </div>
        </div>

        {/* Navigation & Governance Links */}
        <div className="p-2 space-y-0.5 text-xs">
          <div className="px-2.5 py-1.5 text-[10px] font-mono font-semibold uppercase text-muted-foreground/70 tracking-wider">
            Account & Preferences
          </div>

          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-2.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <User className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium leading-tight">Account Profile</p>
                <p className="text-[11px] text-muted-foreground/80 leading-tight">Profile & security preferences</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </Link>

          <Link
            href="/compliance"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-2.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <History className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium leading-tight">Audit Trail</p>
                <p className="text-[11px] text-muted-foreground/80 leading-tight">Compliance & activity records</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </Link>

          <Link
            href="/developer-tests"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-2.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium leading-tight">Acceptance Matrix</p>
                <p className="text-[11px] text-muted-foreground/80 leading-tight">System validation suite</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </Link>

          <Link
            href="/ingestion"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-2.5 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Database className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium leading-tight">Data Ingestion</p>
                <p className="text-[11px] text-muted-foreground/80 leading-tight">Upload and manage datasets</p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </Link>
        </div>

        {/* Footer / Logout */}
        <div className="p-2 border-t border-border/30 bg-muted/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
