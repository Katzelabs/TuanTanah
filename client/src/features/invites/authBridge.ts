// Runtime-safe access to the auth store contract.
//
// `features/auth/index.ts` is the agreed seam for the accounts epic, but it is
// *declarations only* until subtask B lands its implementation — so at runtime
// the module exports nothing and `useAuth` is undefined. Resolving it once at
// module load (rather than per render) keeps hook order stable and lets G's UI
// mount on its own branch instead of crashing the app for everyone.
//
// DELETE THIS FILE when subtask B merges: import `@/features/auth/index.js`.
import type { AuthState } from '@/features/auth/index.js'
import * as authModule from '@/features/auth/index.js'

const GUEST: AuthState = {
  user: null,
  loading: false,
  enabled: false,
  signIn: () => {},
  signOut: async () => {},
  refresh: async () => {},
}

const useAuthOrGuest =
  (authModule as Partial<typeof authModule>).useAuth ??
  (<T>(selector: (s: AuthState) => T): T => selector(GUEST))

/** The signed-in account, or null for guests (and while subtask B is pending). */
export function useAuthUser() {
  return useAuthOrGuest((s) => s.user)
}
