'use client'

import { FileUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ErpMappingWorkspace } from './hooks/use-erp-mapping-workspace'
import type { ProfileChoice } from './types'

const SAVED_LABEL = 'Saved mapping profile'

export function UploadStep({ ws }: { ws: ErpMappingWorkspace }) {
  const choices: { key: ProfileChoice; label: string }[] = [
    ...ws.sourceProfiles.map((p) => ({ key: p.key as ProfileChoice, label: p.label })),
    { key: 'saved', label: SAVED_LABEL },
  ]
  const needsSaved = ws.choice === 'saved' && !ws.savedProfileId

  return (
    <section className="space-y-6 tris-surface p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">1. Choose the data and its layout</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick what the file contains and which layout it follows. You can review every column
          match before anything is imported.
        </p>
      </div>

      <div className="grid gap-2 sm:max-w-md">
        <Label htmlFor="target">What does the file contain?</Label>
        <Select value={ws.targetKey} onValueChange={ws.setTargetKey}>
          <SelectTrigger id="target">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ws.targets.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{ws.target?.description}</p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">File layout</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((c) => (
            <label
              key={c.key}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                ws.choice === c.key
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name="profile-choice"
                className="accent-[var(--primary)]"
                checked={ws.choice === c.key}
                onChange={() => ws.chooseProfile(c.key)}
              />
              {c.label}
            </label>
          ))}
        </div>
        {ws.choice === 'saved' && (
          <div className="sm:max-w-md">
            <Select value={ws.savedProfileId ?? ''} onValueChange={ws.chooseSavedProfile}>
              <SelectTrigger aria-label="Saved mapping profile">
                <SelectValue
                  placeholder={
                    ws.savedProfiles.length ? 'Choose a saved profile' : 'No saved profiles yet'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {ws.savedProfiles.map((p) => (
                  <SelectItem key={p.profile_id} value={p.profile_id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </fieldset>

      <div className="grid gap-2 sm:max-w-md">
        <Label htmlFor="source-file">CSV or Excel file</Label>
        <input
          id="source-file"
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => ws.setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          The SAP-style and Dynamics 365-style options are import demonstrations. Data comes from
          the CSV or Excel file you upload; TRIS does not connect to any ERP system.
        </p>
      </div>

      <Button
        onClick={() => ws.readFile()}
        disabled={!ws.file || ws.busy === 'preview' || needsSaved}
      >
        <FileUp />
        {ws.busy === 'preview' ? 'Reading file...' : 'Read file'}
      </Button>
    </section>
  )
}
