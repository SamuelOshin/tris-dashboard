'use client'

import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldMappingTable } from './field-mapping-table'
import { ResultPanel } from './result-panel'
import { SaveProfileForm } from './save-profile-form'
import { SourcePreview } from './source-preview'
import type { ErpMappingWorkspace } from './hooks/use-erp-mapping-workspace'
import type { DuplicateStrategy } from './types'

interface Props {
  ws: ErpMappingWorkspace
  canSaveProfiles: boolean
}

export function MappingStep({ ws, canSaveProfiles }: Props) {
  if (!ws.preview || !ws.target) return null
  const blocked = ws.missingRequired.length > 0

  return (
    <div className="space-y-6">
      <SourcePreview preview={ws.preview} onSheetChange={(s) => ws.readFile(s)} />
      <FieldMappingTable
        target={ws.target}
        preview={ws.preview}
        mapping={ws.mapping}
        defaults={ws.defaults}
        onColumnChange={ws.setFieldColumn}
        onDefaultChange={ws.setFieldDefault}
      />

      <section className="space-y-4 tris-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">3. Check and import</h2>
        <div className="flex flex-wrap gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dataset-id">Dataset name (optional)</Label>
            <Input
              id="dataset-id"
              value={ws.datasetId}
              onChange={(e) => ws.setDatasetId(e.target.value)}
              placeholder="For example, Synthetic Environment A"
              className="w-72"
              maxLength={100}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="duplicates">Rows that already exist</Label>
            <Select
              value={ws.duplicateStrategy}
              onValueChange={(v) => ws.setDuplicateStrategy(v as DuplicateStrategy)}
            >
              <SelectTrigger id="duplicates" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip them</SelectItem>
                <SelectItem value="fail">Reject them</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {blocked && (
          <p className="text-xs text-destructive">
            Still to match: {ws.missingRequired.join(', ')}.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => ws.setStep('upload')}>
            <ArrowLeft />
            Back
          </Button>
          <Button onClick={ws.runValidation} disabled={blocked || ws.busy !== null}>
            <ShieldCheck />
            {ws.busy === 'validate' ? 'Checking...' : 'Check file'}
          </Button>
        </div>

        {canSaveProfiles ? (
          <SaveProfileForm
            disabled={blocked}
            saving={ws.busy === 'save'}
            onSave={ws.saveProfile}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Saving a mapping for reuse is available to administrators.
          </p>
        )}
      </section>

      {ws.validation && (
        <ResultPanel
          outcome={ws.validation}
          onImport={ws.runImport}
          importing={ws.busy === 'import'}
        />
      )}
    </div>
  )
}
