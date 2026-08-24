// Thin fetch layer over the server's auth routes (`server/src/modules/auth`,
// subtask A). Kept apart from the store so the response handling — which has to
// tolerate a server where accounts are switched off — is unit-testable on its own.
import type { AuthUser } from '@tuan-tanah/shared'

/** What `GET /api/auth/me` tells us: who is signed in, and whether accounts exist. */
export interface MeResult {
  user: AuthUser | null
  enabled: boolean
}

/** Accounts are off (or unreachable): the app stays fully playable as a guest. */
const NO_ACCOUNTS: MeResult = { user: null, enabled: false }
/** Accounts are on, nobody is signed in. */
const GUEST: MeResult = { user: null, enabled: true }

/**
 * Read the current session.
 *
 * Deliberately forgiving: accounts are an *optional* server capability (blank
 * Google credentials disable them, the same opt-in idiom as SENTRY_DSN), so
 * every failure mode — route absent, creds blank, backend down — has to land on
 * "no accounts here" rather than an error a guest would ever see.
 */
export async function fetchMe(): Promise<MeResult> {
  let res: Response
  try {
    res = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
  } catch {
    return NO_ACCOUNTS
  }
  // 401 is the one failure that still means accounts work — there just isn't a
  // session. Anything else (404 on a build without the auth routes, 5xx) is
  // indistinguishable from accounts being switched off, so treat it that way.
  if (res.status === 401) return GUEST
  if (!res.ok) return NO_ACCOUNTS
  try {
    return parseMe((await res.json()) as unknown)
  } catch {
    return NO_ACCOUNTS
  }
}

/** End the session server-side. Idempotent, and never throws at the caller. */
export async function postLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    // The cookie may outlive this, but the UI must still drop back to guest —
    // the store clears local state regardless.
  }
}

/**
 * Normalize the `/api/auth/me` body. The epic's contract fixes `AuthUser`
 * (`shared/types/auth.ts`) but not the envelope around it, so accept both a
 * bare account and a `{ user, enabled }` wrapper instead of guessing one and
 * breaking when subtask A lands.
 */
export function parseMe(body: unknown): MeResult {
  if (!isRecord(body)) return NO_ACCOUNTS
  if (isAuthUser(body)) return { user: body, enabled: true }
  const user = isAuthUser(body.user) ? body.user : null
  // A body that says nothing about `enabled` came from a server that has the
  // route at all, which is itself the answer.
  return { user, enabled: user !== null || body.enabled !== false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Only the fields the UI actually renders are checked; the server owns the rest. */
function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.displayName === 'string'
  )
}
