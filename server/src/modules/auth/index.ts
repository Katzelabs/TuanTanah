// auth — CONTRACT MODULE for ClickUp epic 86ey2z15b (player accounts).
//
// These are the signatures every other subtask codes against. Subtask A fills in
// the implementations; B–G only import from here. Keep the surface stable — a
// change here ripples across every branch in the epic.
//
// Auth is I/O and lives outside `engine/`, which stays pure.
import type { AuthUser, UserId } from '@tuan-tanah/shared'

/** A resolved session, or null when the caller is a guest. */
export interface SessionContext {
  userId: UserId
  sessionId: string
}

/**
 * True when accounts are configured (Google credentials present). Blank creds
 * disable accounts entirely and leave the game fully guest-playable — the same
 * opt-in idiom as SENTRY_DSN / DATABASE_URL.
 */
export declare function authEnabled(): boolean

/** Look up the session behind an opaque cookie token. Null if absent/expired. */
export declare function resolveSession(token: string | undefined): Promise<SessionContext | null>

/** Issue a new session for a user and return the opaque cookie token. */
export declare function createSession(userId: UserId): Promise<string>

/** Revoke a session (logout). Idempotent. */
export declare function destroySession(token: string): Promise<void>

/** Load a full account by id, or null if it no longer exists. */
export declare function getUser(userId: UserId): Promise<AuthUser | null>
