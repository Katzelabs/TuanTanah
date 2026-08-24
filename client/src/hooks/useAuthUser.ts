import { useAuth } from '@/features/auth/index.js'
import type { AuthUser } from '@tuan-tanah/shared'

/**
 * The signed-in account, or `null` for guests.
 *
 * Thin wrapper over the auth store so callers that only need the current user
 * don't each write the selector — and don't re-render on unrelated auth state.
 */
export function useAuthUser(): AuthUser | null {
  return useAuth((s) => s.user)
}
