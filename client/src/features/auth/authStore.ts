// The auth store — subtask B's implementation of the `AuthState` seam declared
// in `./index.ts`.
//
// Separate from `gameStore` on purpose: game state is server-broadcast and
// replaced wholesale on every `game_state`, while the session is client-side and
// must survive that. Nothing here touches the socket.
import { create } from 'zustand'
import { fetchMe, postLogout } from './api.js'
import type { AuthState } from './index.js'

// Boot (App) and any component that wants a re-read can both call `refresh()`;
// sharing the in-flight promise keeps that to one request.
let inFlight: Promise<void> | null = null

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  // Pessimistic until `/api/auth/me` says otherwise, so a guest never sees a
  // sign-in button flash on a server that has accounts switched off.
  enabled: false,

  signIn: () => {
    // A real navigation, not fetch: the flow ends in a cross-origin redirect to
    // Google and comes back to a route that sets the session cookie. XHR can't
    // follow that.
    window.location.assign('/api/auth/google')
  },

  signOut: async () => {
    await postLogout()
    set({ user: null })
  },

  refresh: async () => {
    inFlight ??= fetchMe()
      .then(({ user, enabled }) => {
        set({ user, enabled, loading: false })
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  },
}))
