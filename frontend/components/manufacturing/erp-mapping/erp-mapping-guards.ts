import type {
  FieldMapping,
  PreviewData,
  RunConfig,
  RunOutcome,
  SourceProfileKey,
  TargetInfo,
} from './types'

/** Roles that may upload and import data (mirrors the server rule; the server is the authority). */
const IMPORT_ROLES = ['admin', 'reviewer']
const PROFILE_ADMIN_ROLES = ['admin']

export function canImportData(role?: string | null): boolean {
  return !!role && IMPORT_ROLES.includes(role.toLowerCase())
}

export function canSaveProfiles(role?: string | null): boolean {
  return !!role && PROFILE_ADMIN_ROLES.includes(role.toLowerCase())
}

/** Required fields that have neither a mapped column nor a default value. */
export function missingRequiredFields(
  target: TargetInfo | undefined,
  mapping: FieldMapping,
  defaults: FieldMapping
): string[] {
  if (!target) return []
  return target.fields
    .filter((f) => f.required && !mapping[f.name] && !defaults[f.name]?.trim())
    .map((f) => f.name)
}

/** Keep only entries whose column exists in the file; report the ones that were dropped. */
export function reconcileWithColumns(
  mapping: FieldMapping,
  columns: string[]
): { kept: FieldMapping; dropped: string[] } {
  const kept: FieldMapping = {}
  const dropped: string[] = []
  Object.entries(mapping).forEach(([field, column]) => {
    if (columns.includes(column)) kept[field] = column
    else dropped.push(column)
  })
  return { kept, dropped }
}

export function pickSuggestion(preview: PreviewData, profile: SourceProfileKey): FieldMapping {
  return { ...(preview.suggestions[profile] ?? {}) }
}

export function buildRunConfig(args: {
  target: string
  sourceProfile: SourceProfileKey
  mapping: FieldMapping
  defaults: FieldMapping
  datasetId: string
  duplicateStrategy: RunConfig['duplicate_strategy']
  sheet: string | null
  profileId: string | null
}): RunConfig {
  const defaults = Object.fromEntries(
    Object.entries(args.defaults).filter(([, v]) => v.trim() !== '')
  )
  return {
    target: args.target,
    source_profile: args.sourceProfile,
    field_mapping: args.mapping,
    defaults,
    dataset_id: args.datasetId.trim() || null,
    duplicate_strategy: args.duplicateStrategy,
    sheet: args.sheet,
    profile_id: args.profileId,
  }
}

export type OutcomeTone = 'success' | 'warning' | 'danger'

export function outcomeTone(outcome: RunOutcome): OutcomeTone {
  if (outcome.status === 'FAILED') return 'danger'
  if (outcome.status === 'COMPLETED_WITH_ERRORS' || outcome.summary.rows_rejected > 0) {
    return 'warning'
  }
  return 'success'
}

export function outcomeTitle(outcome: RunOutcome): string {
  if (outcome.status === 'FAILED') return 'Nothing was imported'
  if (outcome.summary.dry_run) return 'Validation finished'
  return outcome.status === 'COMPLETED' ? 'Import complete' : 'Import complete with rejected rows'
}
