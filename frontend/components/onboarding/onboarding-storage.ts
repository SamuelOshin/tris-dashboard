import { WELCOME_STORAGE_KEY } from './onboarding-content'

// Also kept in memory, so with storage blocked the welcome is not repeated on every visit to the dashboard.
let shownThisSession = false

/**
 * The browser remembers that the welcome was shown. Storage can be blocked or empty (private
 * windows, cleared site data), so every access is guarded and the app works without it.
 */
export function hasSeenWelcome(): boolean {
  if (shownThisSession) return true
  try {
    return window.localStorage.getItem(WELCOME_STORAGE_KEY) === 'yes'
  } catch {
    return false
  }
}

export function markWelcomeSeen(): void {
  shownThisSession = true
  try {
    window.localStorage.setItem(WELCOME_STORAGE_KEY, 'yes')
  } catch {
    /* the welcome may appear again next time; nothing else depends on it */
  }
}
