'use client'

import React from 'react'
import { Database, Zap, Shield, Server, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function ComingSoonBadge({ label = 'Coming Soon' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {label}
    </span>
  )
}

interface IntegrationItem {
  name: string
  category: string
  description: string
}

const ERP_INTEGRATIONS: IntegrationItem[] = [
  {
    name: 'SAP S/4HANA',
    category: 'ERP Connector',
    description: 'Automated accounts payable ledger synchronization, purchase order validation, and invoice batch ingestion.',
  },
  {
    name: 'Oracle NetSuite',
    category: 'Cloud Accounting',
    description: 'Continuous synchronization of master vendor registries, approval hierarchies, and disbursement schedules.',
  },
  {
    name: 'Workday Financials',
    category: 'Financial Management',
    description: 'Automated supplier profile verification, banking change reconciliation, and expense ledger monitoring.',
  },
  {
    name: 'Microsoft Dynamics 365 Finance',
    category: 'ERP Connector',
    description: 'General ledger sync and automated approval mapping for multi-entity enterprise procurement.',
  },
]

const ALERTING_INTEGRATIONS: IntegrationItem[] = [
  {
    name: 'Slack',
    category: 'Collaboration',
    description: 'Automated alerts delivered to dedicated risk review channels when cases trigger high-priority composite scores.',
  },
  {
    name: 'Microsoft Teams',
    category: 'Collaboration',
    description: 'Direct webhook incident notifications delivered to corporate compliance and internal audit channels.',
  },
  {
    name: 'PagerDuty',
    category: 'Incident Management',
    description: 'On-call escalation policies triggered for urgent payment holds and off-hours access control failures.',
  },
]

const TELEMETRY_INTEGRATIONS: IntegrationItem[] = [
  {
    name: 'Splunk',
    category: 'SIEM Forwarding',
    description: 'Real-time streaming export of Zero-Trust access events and immutable case transition audit histories.',
  },
  {
    name: 'Datadog',
    category: 'Observability',
    description: 'Continuous monitoring of ingestion pipelines, detection rule evaluation latencies, and security events.',
  },
]

export function IntegrationsTab() {
  return (
    <div className="space-y-6">
      {/* Informational Guidance Banner */}
      <Card className="border-border shadow-xs bg-muted/20">
        <CardContent className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-foreground">Enterprise Ecosystem Connectors</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Automated ERP synchronization and telemetry export connectors are currently in scheduled development. For current evaluations, data can be ingested directly via the Data Ingestion pipeline.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid of Integration Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. ERP & Financial Systems */}
        <Card className="border-border shadow-xs bg-card flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              ERP &amp; Financial Systems
            </CardTitle>
            <CardDescription className="text-xs">
              Automated ledger ingestion and vendor synchronization connectors.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs flex-1">
            {ERP_INTEGRATIONS.map((item) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-muted/20 border border-border/70 flex flex-col justify-between gap-2.5 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground text-xs">{item.name}</span>
                    <ComingSoonBadge />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{item.description}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[10px] font-mono text-muted-foreground">{item.category}</span>
                  <Button disabled variant="outline" size="sm" className="h-7 text-[11px] px-2.5">
                    Connect
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 2. Collaboration & Incident Alerting */}
        <Card className="border-border shadow-xs bg-card flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Collaboration &amp; Alerting
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time incident notifications for high-priority risk exceptions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs flex-1">
            {ALERTING_INTEGRATIONS.map((item) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-muted/20 border border-border/70 flex flex-col justify-between gap-2.5 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground text-xs">{item.name}</span>
                    <ComingSoonBadge />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{item.description}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[10px] font-mono text-muted-foreground">{item.category}</span>
                  <Button disabled variant="outline" size="sm" className="h-7 text-[11px] px-2.5">
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 3. Security & Telemetry Forwarding */}
        <Card className="border-border shadow-xs bg-card flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Security &amp; SIEM Forwarding
            </CardTitle>
            <CardDescription className="text-xs">
              Event streaming for corporate SOC and compliance monitoring.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs flex-1">
            {TELEMETRY_INTEGRATIONS.map((item) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-muted/20 border border-border/70 flex flex-col justify-between gap-2.5 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground text-xs">{item.name}</span>
                    <ComingSoonBadge />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{item.description}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[10px] font-mono text-muted-foreground">{item.category}</span>
                  <Button disabled variant="outline" size="sm" className="h-7 text-[11px] px-2.5">
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
