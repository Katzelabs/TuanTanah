// The session cookie's name and flags, in one place — the HTTP routes set and
// clear it, and the socket handshake reads it, so they must not drift apart.
import type { CookieSerializeOptions } from '@fastify/cookie'
import { isDev } from '../../bootstrap/env.js'
import { sessionTtlSeconds } from './sessionStore.js'

export const SESSION_COOKIE = 'tt_session'

/**
 * `httpOnly` so no script can read the token; `sameSite: 'lax'` because the OAuth
 * callback is a top-level GET navigation *from Google* — `strict` would withhold
 * the cookie on exactly that hop and break sign-in — while still keeping it off
 * cross-site subrequests. `secure` is off in dev only: browsers refuse to store a
 * Secure cookie over plain http://localhost, so leaving it on would make local
 * sign-in fail silently.
 */
export function sessionCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlSeconds(),
  }
}

/** Same attributes minus the lifetime — a clear must match the path it was set on. */
export function clearCookieOptions(): CookieSerializeOptions {
  return { httpOnly: true, secure: !isDev, sameSite: 'lax', path: '/' }
}

/**
 * Pull the session token out of a raw `Cookie:` header.
 *
 * Hand-rolled rather than calling `@fastify/cookie`'s exported `parse`, which
 * lazily loads its backing module during *plugin registration* and throws a null
 * dereference until that has happened. The socket handshake runs outside the
 * Fastify request lifecycle, so relying on it would make identity depend on
 * bootstrap ordering — and the throw lands inside an `io.use` middleware, where
 * it refuses the connection outright. That would take guests down too, for a
 * feature they don't use.
 */
export function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    if (pair.slice(0, eq).trim() !== SESSION_COOKIE) continue
    const raw = pair.slice(eq + 1).trim()
    try {
      return decodeURIComponent(raw) || undefined
    } catch {
      // Malformed percent-encoding — not our cookie in any usable form.
      return undefined
    }
  }
  return undefined
}
