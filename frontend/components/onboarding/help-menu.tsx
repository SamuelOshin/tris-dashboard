'use client'

import { CircleHelp, Compass, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOnboarding } from './onboarding-provider'

/** Top-bar Help button: reopen the welcome page or the tour. */
export function HelpMenu() {
  const { openWelcome, startTour } = useOnboarding()
  return (
    // Not modal: a modal menu that opens a dialog can leave the page unclickable after the dialog closes.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-tour="help"
          aria-label="Help"
          title="Help"
          className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelp className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => setTimeout(openWelcome, 0)} className="gap-2 text-xs">
          <Sparkles className="size-3.5" aria-hidden="true" />
          What is new
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTimeout(startTour, 0)} className="gap-2 text-xs">
          <Compass className="size-3.5" aria-hidden="true" />
          Take the tour
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
