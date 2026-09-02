'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { UploadCloud, CheckCircle2, AlertCircle, Database, FileSpreadsheet, Layers } from 'lucide-react'

export default function IngestionPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel workbook (.xlsx) to ingest.')
      return
    }

    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const data = await api.uploadWorkbook(file)
      setReport(data)
    } catch (err: any) {
      setReport(null)
      setError(err.message || 'Failed to ingest workbook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout
      title="Relational Ingestion Pipeline"
      description="Upload multi-sheet Excel enterprise workbooks into the TRIS relational database schema."
      breadcrumbs={[
        { label: 'TRIS Studio', href: '/' },
        { label: 'Data Ingestion' },
      ]}
    >
      <div className="space-y-6">
        {/* Ingestion Upload Card */}
        <Card className="p-6 bg-card border-border space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-foreground text-sm sm:text-base">Enterprise Workbook Ingestion</h3>
                <p className="text-xs text-muted-foreground">
                  Accepts <code className="font-mono text-foreground font-semibold px-1 rounded bg-muted/40">test data.xlsx</code> containing 8 relational sheets (Suppliers, Transactions, Approvals, Access Events)
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="w-full sm:w-auto text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-muted/40 file:text-foreground hover:file:bg-muted/60 cursor-pointer"
              />
              <Button
                onClick={handleUpload}
                disabled={loading || !file}
                size="sm"
                className="w-full sm:w-auto text-xs gap-2 shrink-0 font-medium"
              >
                <UploadCloud className="w-4 h-4" />
                {loading ? 'Ingesting Pipeline...' : 'Ingest Workbook'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {report && (
            <div className="p-3.5 rounded-xl bg-success/10 text-success border border-success/20 flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p className="font-medium">Workbook uploaded and processed successfully!</p>
            </div>
          )}
        </Card>

        {/* Live Ingestion Summary Cards */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Suppliers', val: report.suppliers_loaded ?? 0, sub: 'Loaded clean' },
              { label: 'Transactions', val: report.transactions_loaded ?? 0, sub: 'Invoices imported' },
              { label: 'Approvals', val: report.approvals_loaded ?? 0, sub: 'Approval history' },
              { label: 'Access Events', val: report.access_events_loaded ?? 0, sub: 'Activity logs' },
              { label: 'Detection Rules', val: report.rules_loaded ?? 0, sub: 'Rules evaluated' },
              { label: 'Seeded Cases', val: report.cases_loaded ?? 0, sub: 'Cases flagged' },
            ].map((item) => (
              <Card key={item.label} className="p-4 bg-card border-border space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">{item.label}</p>
                <p className="text-2xl font-bold text-foreground font-mono">{item.val}</p>
                <span className="text-[10px] text-success font-medium block">{item.sub}</span>
              </Card>
            ))}
          </div>
        )}

        {/* Pipeline Architecture Note */}
        <Card className="p-5 bg-card border-border space-y-2.5">
          <h4 className="font-semibold text-foreground text-xs uppercase font-mono tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Data Processing & Audit Safeguards
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
            <li>Structured validation ensures all invoice amounts, dates, and currency fields are properly formatted.</li>
            <li>Every invoice record is verified and linked to an active, authorized supplier profile.</li>
            <li>All data ingestion events are automatically timestamped and preserved in the audit log.</li>
            <li>Automated data imports can also be configured via scheduled ERP connections and secure file delivery.</li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  )
}
