import { LEVEL_TONE } from '../risk-score/risk-guards'
import type { RiskLevel } from '../risk-score/types'

/** A risk level as text on a tinted pill (never colour alone), or a note when there is none. */
export function RiskLevelPill({ level }: { level: RiskLevel | null }) {
  if (!level) return <span className="text-xs text-muted-foreground">Not scored</span>
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_TONE[level]}`}
    >
      {level}
    </span>
  )
}
