// Which version this browser last acknowledged, for the one-shot "what's new"
// card on the home page.
//
// Per-browser and client-only on purpose. It is a convenience, not a fact worth
// a database row or a server round-trip: the worst outcome of losing it is that
// someone is shown release notes twice, or once too few.
import { APP_VERSION } from '@tuan-tanah/shared'

const KEY = 'tuan-tanah:lastSeenVersion'

/**
 * Every access is guarded. `localStorage` throws outright — not returns null —
 * in a browser configured to block site data, and this runs on the home page,
 * so an unguarded read would take the entire landing page down for those users
 * over a dismissible card.
 */
export function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    // Storage blocked. Treat it as "nothing recorded", which shows no card.
    return null
  }
}

export function markSeen(version: string = APP_VERSION): void {
  try {
    window.localStorage.setItem(KEY, version)
  } catch {
    // Storage blocked — the card will simply appear again next time.
  }
}

/**
 * Whether this player has an update to be told about.
 *
 * A first-ever visitor gets nothing: they have no previous version to have
 * missed, and greeting someone's first game with a list of things that changed
 * before they arrived is noise. Their current version is recorded silently so
 * the *next* release is the first thing they hear about.
 */
export function hasUnseenRelease(): boolean {
  const seen = readLastSeen()
  return seen !== null && seen !== APP_VERSION
}
