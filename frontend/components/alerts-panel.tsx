'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, RiskCase } from '@/lib/api'
import { ShieldAlert, ArrowRight, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export function AlertsPanel() {
  const [cases, setCases] = useState<RiskCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.getCases()
      .then((data) => {
        if (mounted) setCases(data)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <Card className="p-6 h-full space-y-4">
        <div className="h-5 bg-muted/40 rounded w-1/2 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/20 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Risk Intelligence Alerts</h2>
            <p className="text-xs text-muted-foreground">Active anomaly triggers from database</p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {cases.length} Total
          </Badge>
        </div>

        {cases.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <CheckCircle className="w-8 h-8 text-success mx-auto" />
            <p className="text-xs text-muted-foreground">No active risk cases pending investigation.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((c) => (
              <div
                key={c.case_id}
                className="p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">{c.case_id}</span>
                      <Badge
                        variant="outline"
                        className={
                          c.priority.toLowerCase() === 'high'
                            ? 'bg-destructive/10 text-destructive border-destructive/20 text-[10px]'
                            : 'bg-warning/10 text-warning border-warning/20 text-[10px]'
                        }
                      >
                        {c.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target Invoice <span className="font-mono text-foreground font-semibold">{c.transaction_id}</span> · Score: {c.total_score}/100
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {c.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] border-t border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Live'}
                  </span>
                  <Link href={`/cases/${c.case_id}`} className="text-primary font-medium hover:underline flex items-center gap-1">
                    Inspect <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border mt-4">
        <Link href="/developer-tests" className="block">
          <Button variant="outline" size="sm" className="w-full text-xs">
            Open Acceptance Matrix (T01 - T10)
          </Button>
        </Link>
      </div>
    </Card>
  )
}
