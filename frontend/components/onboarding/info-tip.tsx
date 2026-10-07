'use client'

import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GLOSSARY, type GlossaryKey } from './glossary'

/**
 * A small "?" that explains a term in plain words on hover or keyboard focus. The button has a text
 * label for screen readers and works with the keyboard.
 */
export function InfoTip({ term, className = '' }: { term: GlossaryKey; className?: string }) {
  const entry = GLOSSARY[term]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${entry.term.toLowerCase()}?`}
          className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        <span className="font-semibold">{entry.term}.</span> {entry.meaning}
      </TooltipContent>
    </Tooltip>
  )
}
