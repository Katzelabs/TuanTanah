import * as authSeam from '@/features/auth/index.js'
import type { AuthState } from '@/features/auth/index.js'
import type { AuthUser } from '@tuan-tanah/shared'

/**
 * The signed-in account, or `null` for guests.
 *
 * Reads subtask B's store through the `features/auth` contract without hard
 * depending on it: until B lands, that module is types-only (`export declare
 * const useAuth`) and has no runtime `useAuth` binding. A namespace import
 * tolerates that — a named import would not — so this branch degrades to
 * "everyone is a guest" instead of failing to load.
 */
const GUEST: AuthState = {
  user: null,
  loading: false,
  enabled: false,
  signIn: () => {},
  signOut: async () => {},
  refresh: async () => {},
}

type UseAuth = <T>(selector: (s: AuthState) => T) => T

const useAuth: UseAuth =
  (authSeam as Partial<typeof authSeam>).useAuth ?? ((selector) => selector(GUEST))

export function useAuthUser(): AuthUser | null {
  return useAuth((s) => s.user)
}
