import type { RiskCase } from '@/lib/api'
import type { MaterialSnapshot } from './types'

/** Pure predicates and readers for material-cost cases. No state-machine logic lives here. */

export const MATERIAL_COST_RISK = 'material_cost_risk'

export function isMaterialCase(caseData: { case_category?: string } | null | undefined): boolean {
  return caseData?.case_category === MATERIAL_COST_RISK
}

export function categoryLabel(caseData: { case_category?: string } | null | undefined): string {
  return isMaterialCase(caseData) ? 'Material cost risk' : 'Financial exception'
}

/** The snapshot saved when the case was opened (empty object for other cases). */
export function snapshotOf(caseData: Pick<RiskCase, 'evaluation_snapshot'>): MaterialSnapshot | null {
  const snapshot = caseData.evaluation_snapshot as Partial<MaterialSnapshot> | undefined
  return snapshot && snapshot.source === 'material_risk_score' ? (snapshot as MaterialSnapshot) : null
}

export function signedPoints(change: number): string {
  if (Math.abs(change) < 0.05) return 'no change'
  return `${change > 0 ? '+' : ''}${change.toFixed(1)} points`
}
