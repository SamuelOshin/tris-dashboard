'use client'

import React from 'react'
import { Sliders, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

interface SettingsHeaderProps {
  onRefresh: () => void
  loading?: boolean
}

export function SettingsHeader({ onRefresh, loading = false }: SettingsHeaderProps) {
  const { user } = useAuth()

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
          <Sliders className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-foreground">Settings &amp; Governance</h2>
            <Badge variant="outline" className="text-[10px] font-medium bg-primary/10 text-primary border-primary/30 uppercase">
              {user?.role || 'Reviewer'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </span>
            <span>·</span>
            <span>Signed in as <strong className="text-foreground">{user?.email || 'reviewer@tris.internal'}</strong></span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs h-9 gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  )
}
