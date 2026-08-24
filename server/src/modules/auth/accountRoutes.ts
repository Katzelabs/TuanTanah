// HTTP routes for the account settings page (ClickUp 86ey2z15r):
//
//   PATCH  /api/account  { displayName }  -> { user }
//   DELETE /api/account                   -> 204, session revoked
//
// Reading the account is already `GET /api/auth/me` (subtask A) — this module
// only owns the two mutations.
//
// The session functions are injected rather than imported so this file stays
// testable without Redis and without booting the OAuth flow. `./index.ts` is the
// epic's contract and is still declaration-only, so the shape below is a
// structural subset of it, not a second definition of it.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { reportError } from '../../observability/report.js'
import { deleteAccount, normalizeDisplayName, renameAccount } from './account.js'
import type { SessionContext } from './index.js'

/**
 * Name of the opaque session cookie. Must match the one subtask A sets in the
 * OAuth callback — it is not part of the contract module, so it is asserted here
 * and flagged in the epic rather than guessed twice.
 */
export const SESSION_COOKIE = 'tt_session'

export interface AccountRoutesDeps {
  resolveSession(token: string | undefined): Promise<SessionContext | null>
  destroySession(token: string): Promise<void>
}

/** Stable, client-localised failure codes. The client maps these under `account.errors`. */
type ErrorCode = 'unauthenticated' | 'invalid_name' | 'not_found' | 'unavailable'

/**
 * Minimal cookie reader. The server has no cookie plugin registered and this
 * needs exactly one value, so adding `@fastify/cookie` here would mean subtask A
 * and this branch both editing package.json — a lockfile conflict for four lines.
 */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

function fail(reply: FastifyReply, status: number, error: ErrorCode) {
  return reply.code(status).send({ error })
}

export function registerAccountRoutes(app: FastifyInstance, deps: AccountRoutesDeps): void {
  const sessionToken = (request: FastifyRequest) =>
    readCookie(request.headers.cookie, SESSION_COOKIE)

  app.patch('/api/account', async (request, reply) => {
    const token = sessionToken(request)
    const session = await deps.resolveSession(token)
    if (!session) return fail(reply, 401, 'unauthenticated')

    const body = (request.body ?? {}) as { displayName?: unknown }
    const displayName = normalizeDisplayName(body.displayName)
    if (!displayName) return fail(reply, 400, 'invalid_name')

    try {
      const user = await renameAccount(session.userId, displayName)
      // Null covers two states the caller can't tell apart and doesn't need to:
      // the row is gone, or Postgres isn't configured at all. Either way there is
      // no account to rename.
      if (!user) return fail(reply, 404, 'not_found')
      return { user }
    } catch (err) {
      reportError(err, { at: 'accountRoutes.rename', userId: session.userId })
      return fail(reply, 500, 'unavailable')
    }
  })

  app.delete('/api/account', async (request, reply) => {
    const token = sessionToken(request)
    const session = await deps.resolveSession(token)
    if (!session) return fail(reply, 401, 'unauthenticated')

    try {
      const deleted = await deleteAccount(session.userId)
      if (!deleted) return fail(reply, 404, 'not_found')
    } catch (err) {
      reportError(err, { at: 'accountRoutes.delete', userId: session.userId })
      return fail(reply, 500, 'unavailable')
    }

    // The account is gone, so the session must go too — otherwise the cookie
    // keeps resolving to a userId with no row behind it. Order matters: revoke
    // only after the delete succeeded, so a failed delete leaves the player
    // signed in and able to retry.
    //
    // The cookie itself is left for the browser to keep sending; it now resolves
    // to nothing, so the player reads as a guest. Clearing it would mean
    // restating subtask A's cookie attributes here, and a mismatched Secure or
    // SameSite silently fails to clear anything.
    if (token) await deps.destroySession(token)
    return reply.code(204).send()
  })
}
