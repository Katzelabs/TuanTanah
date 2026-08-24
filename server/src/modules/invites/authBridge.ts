// Runtime-safe access to the auth contract module.
//
// `modules/auth/index.ts` is the agreed seam for the accounts epic, but it is
// *declarations only* until subtask A lands its implementation — so at runtime
// it exports nothing. Named imports of a missing export are a hard ESM link
// error, which would take the whole server down on every branch that consumes
// the seam before A merges. A namespace import plus these guards keeps invites
// inert-but-harmless on their own branch and makes them live the moment A is in.
//
// DELETE THIS FILE when subtask A merges: import `../auth/index.js` directly.
import * as auth from '../auth/index.js'
import type { SessionContext } from '../auth/index.js'
import type { AuthUser, UserId } from '@tuan-tanah/shared'

type MaybeAuth = Partial<typeof auth>

/** True once accounts are configured AND subtask A's implementation is present. */
export function authEnabled(): boolean {
  return (auth as MaybeAuth).authEnabled?.() ?? false
}

export async function resolveSession(token: string | undefined): Promise<SessionContext | null> {
  return (await (auth as MaybeAuth).resolveSession?.(token)) ?? null
}

export async function getUser(userId: UserId): Promise<AuthUser | null> {
  return (await (auth as MaybeAuth).getUser?.(userId)) ?? null
}
