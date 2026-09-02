'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function HeaderSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      console.log('[v0] Searching for:', query)
      // Implement search functionality
    }
  }

  return (
    <div className="flex items-center gap-2 flex-1 max-w-sm">
      {isOpen ? (
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full">
          <Input
            placeholder="Search invoices, suppliers, alerts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-sm rounded-lg"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsOpen(false)
              setQuery('')
            }}
            className="h-8 w-8 rounded-lg"
          >
            <X className="w-3 h-3" />
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="rounded-lg text-muted-foreground hover:text-foreground"
          title="Search (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
