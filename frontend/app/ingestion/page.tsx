'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { UploadCloud, CheckCircle2, AlertCircle, Database, FileSpreadsheet, ShieldAlert } from 'lucide-react'

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
    try {
      const data = await api.uploadWorkbook(file)
      setReport(data)
    } catch (err: any) {
      setError(err.message || 'Failed to ingest workbook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relational Ingestion Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Upload and ingest multi-sheet Excel enterprise workbooks into the TRIS relational database.
          </p>
        </div>

        {/* Ingestion Upload Card */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary/10 rounded-xl text-primary">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Synthetic Test Dataset Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Accepts <code>test data.xlsx</code> containing 8 sheets (Suppliers, Transactions, Approvals, Access Events, etc.)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
              />
              <Button
                onClick={handleUpload}
                disabled={loading || !file}
                className="flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                {loading ? 'Ingesting...' : 'Ingest Workbook'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {report && (
            <div className="mt-4 p-4 rounded-lg bg-success/10 text-success flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Workbook ingested successfully into PostgreSQL relational schema!</p>
            </div>
          )}
        </Card>

        {/* Live Ingestion Summary Cards */}
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Suppliers</p>
              <p className="text-2xl font-bold text-foreground mt-1">{report.suppliers_loaded ?? 0}</p>
              <span className="text-xs text-success">Loaded clean</span>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Transactions</p>
              <p className="text-2xl font-bold text-foreground mt-1">{report.transactions_loaded ?? 0}</p>
              <span className="text-xs text-success">Includes TX-1999</span>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Approvals</p>
              <p className="text-2xl font-bold text-foreground mt-1">{report.approvals_loaded ?? 0}</p>
              <span className="text-xs text-success">Control matrix</span>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Access Events</p>
              <p className="text-2xl font-bold text-foreground mt-1">{report.access_events_loaded ?? 0}</p>
              <span className="text-xs text-success">Telemetry events</span>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Detection Rules</p>
              <p className="text-2xl font-bold text-foreground mt-1">{report.rules_loaded ?? 0}</p>
              <span className="text-xs text-success">R-001 to R-006</span>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Seeded Cases</p>
              <p className="text-2xl font-bold text-foreground mt-1">{report.cases_loaded ?? 0}</p>
              <span className="text-xs text-success">TEST-CASE-001</span>
            </Card>
          </div>
        )}

        {/* Pipeline Architecture Note */}
        <Card className="p-6 bg-card/50">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-2">Relational Ingestion Specifications</h3>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Ingestion parses 8 sheets using pandas and openpyxl, casting typed dates and numeric floats.</li>
            <li>Strict foreign key integrity enforces transactions reference registered suppliers.</li>
            <li>Automatic CaseHistory append-only logger initializes the immutable audit trail for imported cases.</li>
            <li>Supports hot reloading via CLI: <code>uv run python -m app.scripts.seed --data-file &quot;../test data.xlsx&quot;</code>.</li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  )
}
