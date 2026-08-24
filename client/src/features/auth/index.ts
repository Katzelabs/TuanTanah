// features/auth — CONTRACT MODULE for ClickUp epic 86ey2z15b (player accounts).
//
// The store shape every other client subtask codes against. Subtask B fills in
// the implementation; C/D/F/G only import from here.
//
// Deliberately SEPARATE from gameStore: game state is server-broadcast and
// replaced wholesale on every `game_state`, and auth state must not be clobbered
// by that.
import type { AuthUser } from '@tuan-tanah/shared'

export interface AuthState {
  /** Null while loading and for guests. */
  user: AuthUser | null
  /** True until the initial GET /api/auth/me settles. */
  loading: boolean
  /** False when the server has accounts disabled (blank Google creds). */
  enabled: boolean
  /** Navigate to the Google flow. */
  signIn: () => void
  signOut: () => Promise<void>
  /** Re-read the session (after returning from the OAuth redirect). */
  refresh: () => Promise<void>
}

// Implementation (subtask B). The store honours the `<T>(selector) => T` shape
// this seam promised, and adds zustand's own API (`getState`, `subscribe`) on top.
export { useAuth } from './authStore.js'

// Header UI, exported so the other subtasks reuse this chip/button rather than
// building a second one.
export { AuthMenu } from './AuthMenu.js'
export { SignInButton } from './SignInButton.js'
export { Avatar } from './Avatar.js'
export { initialsOf } from './lib/initials.js'
