'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { request } from '@/lib/api'
import type { ScoreDetail } from './types'

interface CaseSummary {
  case_id: string
  case_number: string
  status: string
  score_ids: string[]
}

interface Props {
  score: ScoreDetail
}

const ELIGIBLE = ['High', 'Critical']

/** Open a case from a High or Critical score, or link the score to the case already open. */
export function MaterialCaseAction({ score }: Props) {
  const [cases, setCases] = useState<CaseSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    return request<CaseSummary[]>(`/manufacturing/material-cases/for-material/${encodeURIComponent(score.material_id)}`)
      .then((list) => {
        setFailed(false)
        setCases(list)
      })
      .catch(() => setFailed(true))
  }, [score.material_id])

  useEffect(() => {
    void load()
  }, [load, score.score_id])

  if (!ELIGIBLE.includes(score.level)) return null
  if (failed || cases === null) {
    return failed ? (
      <p className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        Cases for this material could not be loaded, so a case cannot be opened right now.
      </p>
    ) : null
  }
  const open = cases.find((c) => c.status !== 'Closed')

  const send = async (linkCaseId?: string) => {
    setBusy(true)
    try {
      await request('/manufacturing/material-cases', {
        method: 'POST',
        body: JSON.stringify({ score_id: score.score_id, link_case_id: linkCaseId ?? null }),
      })
      toast.success(linkCaseId ? 'Score linked to the case' : 'Case opened')
      await load()
    } catch {
      /* the request layer already told the user what went wrong */
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
        <p className="text-muted-foreground">This material is at {score.level} risk. Open a case to investigate it.</p>
        <Button size="sm" className="ml-auto" onClick={() => send()} disabled={busy}>
          {busy ? 'Opening...' : 'Open a case'}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
      <p className="text-muted-foreground">
        Case{' '}
        <Link href={`/cases/${open.case_id}`} className="font-mono font-semibold text-primary hover:underline">
          {open.case_number}
        </Link>{' '}
        is open ({open.status}).
      </p>
      {!open.score_ids.includes(score.score_id) && (
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => send(open.case_id)} disabled={busy}>
          {busy ? 'Linking...' : 'Link this score'}
        </Button>
      )}
    </div>
  )
}
