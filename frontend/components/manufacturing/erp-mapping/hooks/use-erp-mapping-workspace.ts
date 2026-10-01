'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { mappingApi } from '../mapping-api'
import {
  buildRunConfig,
  missingRequiredFields,
  pickSuggestion,
  reconcileWithColumns,
} from '../erp-mapping-guards'
import type {
  DuplicateStrategy,
  FieldMapping,
  PreviewData,
  ProfileChoice,
  RunOutcome,
  SavedProfile,
  SourceProfileInfo,
  SourceProfileKey,
  TargetInfo,
  WizardStep,
} from '../types'

type Busy = 'preview' | 'validate' | 'import' | 'save' | null

/** Orchestrates the upload → mapping → results flow; presentation components stay stateless. */
export function useErpMappingWorkspace() {
  const [targets, setTargets] = useState<TargetInfo[]>([])
  const [sourceProfiles, setSourceProfiles] = useState<SourceProfileInfo[]>([])
  const [metaError, setMetaError] = useState<string | null>(null)
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([])

  const [step, setStep] = useState<WizardStep>('upload')
  const [targetKey, setTargetKey] = useState('purchase_records')
  const [choice, setChoice] = useState<ProfileChoice>('generic')
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [mapping, setMapping] = useState<FieldMapping>({})
  const [defaults, setDefaults] = useState<FieldMapping>({})
  const [datasetId, setDatasetId] = useState('')
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip')

  const [validation, setValidation] = useState<RunOutcome | null>(null)
  const [outcome, setOutcome] = useState<RunOutcome | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  const target = useMemo(() => targets.find((t) => t.key === targetKey), [targets, targetKey])
  const savedProfile = savedProfiles.find((p) => p.profile_id === savedProfileId) ?? null
  const missingRequired = missingRequiredFields(target, mapping, defaults)
  const sourceProfile: SourceProfileKey =
    choice === 'saved' ? (savedProfile?.source_profile ?? 'generic') : choice

  useEffect(() => {
    mappingApi
      .getTargets()
      .then((data) => {
        setTargets(data.targets)
        setSourceProfiles(data.source_profiles)
      })
      .catch((err: Error) => setMetaError(err.message))
  }, [])

  const refreshProfiles = useCallback(async (key: string) => {
    try {
      setSavedProfiles((await mappingApi.listProfiles(key)).profiles)
    } catch {
      setSavedProfiles([])
    }
  }, [])

  useEffect(() => {
    void refreshProfiles(targetKey)
    setSavedProfileId(null)
  }, [targetKey, refreshProfiles])

  const clearResults = () => {
    setValidation(null)
    setOutcome(null)
  }

  const applySaved = useCallback((profile: SavedProfile, data: PreviewData) => {
    const { kept, dropped } = reconcileWithColumns(profile.field_mapping, data.columns)
    setMapping(kept)
    setDefaults({ ...profile.defaults })
    if (dropped.length > 0) {
      toast.warning(`${dropped.length} saved column(s) are not in this file: ${dropped.join(', ')}`)
    }
  }, [])

  const readFile = async (sheetOverride?: string) => {
    if (!file) return
    setBusy('preview')
    try {
      const data = await mappingApi.preview(file, targetKey, sheetOverride ?? sheet)
      setPreview(data)
      setSheet(data.selected_sheet)
      clearResults()
      if (choice === 'saved' && savedProfile) {
        applySaved(savedProfile, data)
      } else {
        const detected = choice === 'saved' ? 'generic' : data.suggested_profile
        setChoice(detected)
        setMapping(pickSuggestion(data, detected))
        setDefaults({})
      }
      setStep('mapping')
    } catch {
      /* the request layer already told the user what went wrong */
    } finally {
      setBusy(null)
    }
  }

  const chooseProfile = (next: ProfileChoice) => {
    setChoice(next)
    clearResults()
    if (next !== 'saved' && preview) {
      setMapping(pickSuggestion(preview, next))
      setDefaults({})
    } else if (next === 'saved' && savedProfile && preview) {
      applySaved(savedProfile, preview)
    }
  }

  const chooseSavedProfile = (id: string) => {
    setSavedProfileId(id)
    const profile = savedProfiles.find((p) => p.profile_id === id)
    if (profile && preview) {
      applySaved(profile, preview)
      clearResults()
    }
  }

  const setFieldColumn = (field: string, column: string) => {
    clearResults()
    setMapping((prev) => {
      const next = { ...prev }
      if (column) next[field] = column
      else delete next[field]
      return next
    })
  }

  const setFieldDefault = (field: string, value: string) => {
    clearResults()
    setDefaults((prev) => ({ ...prev, [field]: value }))
  }

  const config = () =>
    buildRunConfig({
      target: targetKey,
      sourceProfile,
      mapping,
      defaults,
      datasetId,
      duplicateStrategy,
      sheet,
      profileId: choice === 'saved' ? savedProfileId : null,
    })

  const runValidation = async () => {
    if (!file) return
    setBusy('validate')
    try {
      setValidation(await mappingApi.validate(file, config()))
    } catch {
      /* surfaced by the request layer */
    } finally {
      setBusy(null)
    }
  }

  const runImport = async () => {
    if (!file) return
    setBusy('import')
    try {
      const result = await mappingApi.runImport(file, config())
      setOutcome(result)
      setStep('results')
      if (result.status === 'COMPLETED') toast.success('Import complete')
    } catch {
      /* surfaced by the request layer */
    } finally {
      setBusy(null)
    }
  }

  const saveProfile = async (name: string, description: string) => {
    setBusy('save')
    try {
      const saved = await mappingApi.saveProfile({
        name,
        description: description || undefined,
        source_profile: sourceProfile,
        target: targetKey,
        field_mapping: mapping,
        defaults: config().defaults,
      })
      toast.success('Mapping profile saved')
      await refreshProfiles(targetKey)
      return saved
    } catch {
      return null
    } finally {
      setBusy(null)
    }
  }

  const reset = () => {
    setStep('upload')
    setFile(null)
    setSheet(null)
    setPreview(null)
    setMapping({})
    setDefaults({})
    clearResults()
  }

  return {
    targets, sourceProfiles, metaError, savedProfiles, step, setStep, target, targetKey,
    choice, savedProfileId, file, sheet, preview, mapping, defaults, datasetId,
    duplicateStrategy, validation, outcome, busy, missingRequired,
    setTargetKey, setFile, setSheet, setDatasetId, setDuplicateStrategy, readFile,
    chooseProfile, chooseSavedProfile, setFieldColumn, setFieldDefault, runValidation,
    runImport, saveProfile, reset,
  }
}

export type ErpMappingWorkspace = ReturnType<typeof useErpMappingWorkspace>
