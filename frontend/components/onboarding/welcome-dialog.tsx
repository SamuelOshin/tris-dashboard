'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CircleCheck, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { canViewManufacturing } from '@/components/manufacturing/manufacturing-navigation'
import { WELCOME_INTRO, WHATS_NEW } from './onboarding-content'

interface Props {
  open: boolean
  role: string | undefined
  onClose: () => void
  onStartTour: () => void
}

function roleLine(role: string | undefined): string {
  switch (role?.toLowerCase()) {
    case 'verifier':
      return 'Your role verifies and closes cases that others have investigated; you cannot verify a case you worked on.'
    case 'process_owner':
      return 'Your role works cases through to corrective action and can review how a decision would have gone at the time.'
    default:
      return 'Your role works with cases in the review workflow.'
  }
}

/** The first-visit welcome: what TRIS is, what is new, and an offer of a short tour. */
export function WelcomeDialog({ open, role, onClose, onStartTour }: Props) {
  const showsManufacturing = canViewManufacturing(role)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="tris-surface fixed left-1/2 top-1/2 z-[91] max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6 focus-visible:outline-none sm:p-7"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Shield className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                Welcome to TRIS
              </DialogPrimitive.Title>
              <p className="text-xs text-muted-foreground">Trust &amp; Risk Intelligence System</p>
            </div>
          </div>

          <DialogPrimitive.Description className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {WELCOME_INTRO}
          </DialogPrimitive.Description>

          {showsManufacturing ? (
            <section className="mt-5" aria-label="What is new">
              <h2 className="text-sm font-semibold text-foreground">What is new</h2>
              <ul className="mt-2 space-y-2.5">
                {WHATS_NEW.map((item) => (
                  <li key={item.title} className="flex gap-2.5">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-sm leading-snug text-muted-foreground">
                      <span className="font-medium text-foreground">{item.title}.</span> {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {roleLine(role)} Cases can now also come from material cost signals.
            </p>
          )}

          <p className="mt-5 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Everything you see in this environment is synthetic test data.
          </p>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Skip for now
            </Button>
            <Button onClick={onStartTour}>Take a quick tour</Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
