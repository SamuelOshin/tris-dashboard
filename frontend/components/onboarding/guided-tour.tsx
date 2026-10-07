'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { TourStep } from './onboarding-content'

const CARD_WIDTH = 340
const GAP = 14
const PADDING = 6

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

/** The element a step points at, if it is on the page and actually visible. */
function findTarget(step: TourStep): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
  if (!el) return null
  const box = el.getBoundingClientRect()
  return box.width > 0 && box.height > 0 ? el : null
}

function place(rect: Rect, cardHeight: number): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Beside the target when there is room (the sidebar), otherwise below or above it.
  let left = rect.left + rect.width + GAP
  let top = rect.top
  if (left + CARD_WIDTH > vw - 12) {
    left = rect.left + rect.width / 2 - CARD_WIDTH / 2
    top = rect.top + rect.height + GAP
    if (top + cardHeight > vh - 12) top = rect.top - cardHeight - GAP
  }
  left = Math.min(Math.max(12, left), vw - CARD_WIDTH - 12)
  top = Math.min(Math.max(12, top), Math.max(12, vh - cardHeight - 12))
  return { top, left }
}

/**
 * A step-by-step tour. It dims the page, outlines one element at a time and explains it. Steps
 * whose element is not on the page are left out, and if the element disappears mid-tour (for
 * example the window is made narrow) the tour moves on or ends. Keyboard: Right and Left for next
 * and back, Escape to leave, Tab stays inside the card. Focus returns to where it was when the
 * tour ends. Nothing is saved and nothing on the page is changed.
 *
 * The parent gives this component a new `key` for each run, so every run starts from step one.
 */
export function GuidedTour({
  active,
  steps,
  onClose,
}: {
  active: boolean
  steps: TourStep[]
  onClose: () => void
}) {
  const [available, setAvailable] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardHeight, setCardHeight] = useState(190)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const returnFocusTo = useRef<HTMLElement | null>(null)

  // On start keep only the steps that have something to point at; end at once if none do.
  useEffect(() => {
    if (!active) return
    const usable = steps.filter((step) => findTarget(step))
    if (usable.length === 0) return onClose()
    setAvailable(usable)
    setIndex(0)
  }, [active, steps, onClose])

  // Remember where focus was, and give it back when the tour ends.
  useEffect(() => {
    if (!active) return
    returnFocusTo.current = document.activeElement as HTMLElement | null
    return () => {
      const back = returnFocusTo.current
      const target =
        back && back !== document.body && document.contains(back)
          ? back
          : document.querySelector<HTMLElement>('[data-tour="help"]')
      target?.focus()
    }
  }, [active])

  const step = active ? available[index] : undefined

  const measure = useCallback(() => {
    if (!step) return
    const el = findTarget(step)
    if (el) {
      const box = el.getBoundingClientRect()
      return setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
    }
    // The element went away (for example the menu was hidden by a narrower window).
    const still = available.filter((s) => findTarget(s))
    if (still.length === 0) return onClose()
    const nextIndex = Math.min(index, still.length - 1)
    setAvailable(still)
    setIndex(nextIndex)
    setRect(null)
  }, [step, available, index, onClose])

  useLayoutEffect(() => {
    if (!step) return
    findTarget(step)?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, measure])

  useEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight)
    nextRef.current?.focus()
  }, [step])

  const last = index >= available.length - 1
  const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'ArrowRight') return next()
      if (e.key === 'ArrowLeft') return back()
      if (e.key !== 'Tab' || !cardRef.current) return
      // Keep Tab inside the card: the page behind it is dimmed and not part of the tour.
      const items = Array.from(cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (items.length === 0) return
      const first = items[0]
      const lastItem = items[items.length - 1]
      const focused = document.activeElement
      if (!cardRef.current.contains(focused)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && focused === first) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && focused === lastItem) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, next, back, onClose])

  if (!active || !step || !rect) return null
  const spot = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  }
  const pos = place(spot, cardHeight)

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div
        className="pointer-events-none fixed rounded-xl transition-all duration-200"
        style={{
          ...spot,
          // An outline in the brand colour, then the dimming of everything else.
          boxShadow: '0 0 0 2px var(--primary), 0 0 0 9999px rgba(0, 0, 0, 0.62)',
        }}
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tris-surface fixed p-4 shadow-2xl"
        style={{ top: pos.top, left: pos.left, width: CARD_WIDTH }}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Step {index + 1} of {available.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-sm font-semibold text-foreground">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={back} disabled={index === 0}>
              Back
            </Button>
            <Button ref={nextRef} size="sm" onClick={next}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
