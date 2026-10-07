import { redirect } from 'next/navigation'

/**
 * The v1.x Compliance & Reporting page showed fixed sample figures (a compliance score, framework
 * statuses and an invented audit trail), not real events. It is no longer reachable: the real audit
 * log is on Manufacturing > Administration (administrators).
 */
export default function CompliancePage() {
  redirect('/')
}
