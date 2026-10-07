'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PAGE_SIZE } from '../admin-api'
import { formatWhen } from '../admin-guards'
import { useAuditLog } from '../hooks/use-audit-log'

/** Who did what and when: imports, runs, configuration changes, case openings and sign-ins. Read only. */
export function AuditTab() {
  const log = useAuditLog()
  const { data, filters } = log
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        The audit trail cannot be edited or deleted. Each entry is saved together with the action it describes, and the
        person is the one who was signed in.
      </p>
      <div className="grid gap-3 tris-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="grid gap-1">
          <label htmlFor="audit-type" className="text-[11px] text-muted-foreground">
            What happened
          </label>
          <select
            id="audit-type"
            value={filters.event_type}
            onChange={(e) => log.update({ event_type: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Everything</option>
            {data?.event_types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="audit-actor" className="text-[11px] text-muted-foreground">
            Who
          </label>
          <Input id="audit-actor" placeholder="User name" value={filters.actor} onChange={(e) => log.update({ actor: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <label htmlFor="audit-since" className="text-[11px] text-muted-foreground">
            From
          </label>
          <Input id="audit-since" type="date" value={filters.since} onChange={(e) => log.update({ since: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <label htmlFor="audit-until" className="text-[11px] text-muted-foreground">
            To
          </label>
          <Input id="audit-until" type="date" value={filters.until} onChange={(e) => log.update({ until: e.target.value })} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={log.clear}>
            Clear filters
          </Button>
        </div>
      </div>
      {log.error && <p className="text-sm text-destructive">The audit trail could not be loaded: {log.error}</p>}
      {!data && log.loading && <Skeleton className="h-64 w-full" />}
      {data && (
        <div className="overflow-x-auto tris-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">What happened</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-border ${log.loading ? 'opacity-60' : ''}`}>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No entries match these filters.
                  </td>
                </tr>
              )}
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatWhen(e.occurred_at)}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <p className="font-medium text-foreground">{e.actor ?? '—'}</p>
                    {e.actor_role && <p className="text-muted-foreground">{e.actor_role}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-foreground">{e.event}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {e.detail ?? '—'}
                    {e.resource_id ? <span className="ml-1 font-mono text-[10px]">({e.resource_id})</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {data.total} {data.total === 1 ? 'entry' : 'entries'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={filters.page === 0} onClick={() => log.goTo(filters.page - 1)}>
              Previous
            </Button>
            <span>
              Page {filters.page + 1} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={filters.page + 1 >= pages} onClick={() => log.goTo(filters.page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
