import { LEVEL_TONE } from './risk-guards'
import type { ScoreSummary } from './types'

/** Score and level, or a plain note when no score has been calculated for the material. */
export function RiskBadge({ score }: { score?: ScoreSummary }) {
  if (!score) return <span className="text-xs text-muted-foreground">Not calculated</span>
  return (
    <span
      title={score.summary}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${LEVEL_TONE[score.level]}`}
    >
      {score.score.toFixed(1)}
      <span className="font-normal">{score.level}</span>
    </span>
  )
}
