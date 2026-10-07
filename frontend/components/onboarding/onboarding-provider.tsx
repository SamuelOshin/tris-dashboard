'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { GuidedTour } from './guided-tour'
import { stepsFor } from './onboarding-content'
import { hasSeenWelcome, markWelcomeSeen } from './onboarding-storage'
import { WelcomeDialog } from './welcome-dialog'

interface OnboardingApi {
  openWelcome: () => void
  startTour: () => void
}

const OnboardingContext = createContext<OnboardingApi | null>(null)

/**
 * Owns the welcome dialog and the tour. The welcome opens by itself once per browser, on the
 * dashboard, after sign-in; the Help menu can open either at any time.
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [tourOn, setTourOn] = useState(false)
  const [tourRun, setTourRun] = useState(0)
  const role = user?.role

  useEffect(() => {
    if (user && pathname === '/' && !hasSeenWelcome()) setWelcomeOpen(true)
  }, [user, pathname])

  const closeWelcome = useCallback(() => {
    markWelcomeSeen()
    setWelcomeOpen(false)
  }, [])

  const startTour = useCallback(() => {
    markWelcomeSeen()
    setWelcomeOpen(false)
    // Let the dialog finish closing so its overlay is gone before the tour measures the page.
    setTimeout(() => {
      setTourRun((n) => n + 1) // a new run always starts from the first step, even if one is open
      setTourOn(true)
    }, 150)
  }, [])

  const closeTour = useCallback(() => setTourOn(false), [])

  const api = useMemo<OnboardingApi>(
    () => ({ openWelcome: () => setWelcomeOpen(true), startTour }),
    [startTour]
  )
  const steps = useMemo(() => stepsFor(role), [role])

  return (
    <OnboardingContext.Provider value={api}>
      {children}
      {user && (
        <>
          <WelcomeDialog open={welcomeOpen} role={role} onClose={closeWelcome} onStartTour={startTour} />
          <GuidedTour key={tourRun} active={tourOn} steps={steps} onClose={closeTour} />
        </>
      )}
    </OnboardingContext.Provider>
  )
}

/** Open the welcome or the tour from anywhere under the layout (a no-op outside it). */
export function useOnboarding(): OnboardingApi {
  return useContext(OnboardingContext) ?? { openWelcome: () => {}, startTour: () => {} }
}
