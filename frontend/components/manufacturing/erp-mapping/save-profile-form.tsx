'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  disabled: boolean
  saving: boolean
  onSave: (name: string, description: string) => Promise<unknown>
}

/** Save the current mapping for reuse. Form state stays local to avoid re-rendering the page. */
export function SaveProfileForm({ disabled, saving, onSave }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const submit = async () => {
    const saved = await onSave(name.trim(), description.trim())
    if (saved) {
      setName('')
      setDescription('')
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="profile-name">Save this mapping as</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="For example, Plant A purchase orders"
          className="w-64"
          maxLength={120}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="profile-description">Note (optional)</Label>
        <Input
          id="profile-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-64"
          maxLength={500}
        />
      </div>
      <Button variant="outline" onClick={submit} disabled={disabled || saving || !name.trim()}>
        <Save />
        {saving ? 'Saving...' : 'Save mapping'}
      </Button>
    </div>
  )
}
