'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhen } from '../admin-guards'
import type { MappingProfile } from '../types'

interface Props {
  profiles: MappingProfile[]
  busy: string | null
  onDelete: (profile: MappingProfile) => void
}

/** Saved column mappings. Deleting one never changes an import already made with it. */
export function ProfilesTab({ profiles, busy, onDelete }: Props) {
  if (profiles.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        No mapping has been saved. Save one on the ERP/BOM Data Mapping page after matching a file&apos;s columns.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto tris-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Contains</th>
            <th className="px-3 py-2 font-medium">Saved</th>
            <th className="px-3 py-2 font-medium">By</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {profiles.map((p) => (
            <tr key={p.profile_id}>
              <td className="px-3 py-2.5">
                <p className="font-medium text-foreground">{p.name}</p>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.target.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatWhen(p.created_at)}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.created_by}</td>
              <td className="px-3 py-2.5 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === `profile:${p.profile_id}`}
                  onClick={() => onDelete(p)}
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
