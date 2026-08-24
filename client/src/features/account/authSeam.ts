// Access to the shared auth store (ClickUp epic 86ey2z15b).
//
// `features/auth/index.ts` is the epic's client contract and is still
// declaration-only — subtask B ships the implementation. Importing `useAuth` by
// name would not link: `vite build` fails the whole bundle and the browser
// rejects the module, so a not-yet-implemented seam would take the entire app
// down rather than just this page.
//
// A namespace import binds late instead, and falls back to a "signed out,
// accounts unavailable" snapshot — which is also exactly what the page should
// render on a server with accounts switched off. Once B has landed this file
// collapses to `export { useAuth as useAuthState } from '@/features/auth/index.js'`.
import * as authSeam from '@/features/auth/index.js'
import type { AuthState } from '@/features/auth/index.js'

const noop = () => {}
const resolved = () => Promise.resolve()

const UNAVAILABLE: AuthState = {
  user: null,
  loading: false,
  enabled: false,
  signIn: noop,
  signOut: resolved,
  refresh: resolved,
}

export const useAuthState: typeof authSeam.useAuth =
  authSeam.useAuth ?? (<T>(selector: (s: AuthState) => T) => selector(UNAVAILABLE))
