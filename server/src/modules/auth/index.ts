// auth — CONTRACT MODULE for ClickUp epic 86ey2z15b (player accounts).
//
// These are the signatures every other subtask codes against. Subtask A fills in
// the implementations; B–G only import from here. Keep the surface stable — a
// change here ripples across every branch in the epic.
//
// Auth is I/O and lives outside `engine/`, which stays pure.
import type { AuthUser, UserId } from '@tuan-tanah/shared'
import { env } from '../../bootstrap/env.js'
import { dropSession, putSession, readSession } from './sessionStore.js'
import { loadUser } from './users.js'

/** A resolved session, or null when the caller is a guest. */
export interface SessionContext {
  userId: UserId
  sessionId: string
}

/**
 * True when accounts are configured (Google credentials present). Blank creds
 * disable accounts entirely and leave the game fully guest-playable — the same
 * opt-in idiom as SENTRY_DSN / DATABASE_URL.
 *
 * DATABASE_URL is part of "configured": accounts live in Postgres, so with
 * credentials but no database the sign-in button would render and then fail at
 * the callback. Reporting disabled is the honest answer — and it keeps guest
 * play, which needs neither, completely unaffected.
 */
export function authEnabled(): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret && env.databaseUrl)
}

/** Look up the session behind an opaque cookie token. Null if absent/expired. */
export async function resolveSession(token: string | undefined): Promise<SessionContext | null> {
  if (!token) return null
  const userId = await readSession(token)
  if (!userId) return null
  return { userId, sessionId: token }
}

/** Issue a new session for a user and return the opaque cookie token. */
export async function createSession(userId: UserId): Promise<string> {
  return putSession(userId)
}

/** Revoke a session (logout). Idempotent. */
export async function destroySession(token: string): Promise<void> {
  await dropSession(token)
}

/** Load a full account by id, or null if it no longer exists. */
export async function getUser(userId: UserId): Promise<AuthUser | null> {
  return loadUser(userId)
}
