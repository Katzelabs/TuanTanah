// Google as an OpenID Connect provider: the fixed bits of the flow (paths,
// scopes) plus the single userinfo round trip we make with the access token.
//
// The scope list is load-bearing, not a default. `openid`/`email`/`profile` are
// Google's *non-sensitive* scopes: they need no verification review and cost
// nothing. Adding anything beyond them changes both, so this array is a decision
// recorded in code (see ../../../docs, ClickUp epic 86ey2z15b) — not a knob.
import { env } from '../../bootstrap/env.js'

export const GOOGLE_SCOPES = ['openid', 'email', 'profile'] as const

/** Where the sign-in button sends the browser. Registered by @fastify/oauth2. */
export const GOOGLE_START_PATH = '/api/auth/google'

/** Where Google sends it back. Must be registered in the console byte-for-byte. */
export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback'

/**
 * Absolute redirect URI. Built from PUBLIC_ORIGIN because the browser's origin —
 * the Vite dev proxy or Caddy in prod — is not this process's own host:port, and
 * Google compares this string exactly against its allowlist.
 */
export function googleCallbackUri(): string {
  return `${env.publicOrigin}${GOOGLE_CALLBACK_PATH}`
}

const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const USERINFO_TIMEOUT_MS = 8_000

/** The only three claims we take from Google. Everything else is dropped. */
export interface GoogleProfile {
  /** Stable per-account id. This — never the email — is what we key identities on. */
  sub: string
  email: string | null
  name: string | null
}

interface UserinfoResponse {
  sub?: unknown
  email?: unknown
  name?: unknown
}

/**
 * Exchange an access token for the user's profile. Called once, immediately after
 * the code exchange; the token is discarded straight afterwards, which is why
 * `access_type=online` is requested and no refresh token is ever issued — there
 * are no Google credentials at rest to encrypt, rotate, or leak.
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Google userinfo failed with ${res.status}`)
  }
  const body = (await res.json()) as UserinfoResponse
  if (typeof body.sub !== 'string' || body.sub.length === 0) {
    throw new Error('Google userinfo returned no subject id')
  }
  return {
    sub: body.sub,
    email: typeof body.email === 'string' ? body.email : null,
    name: typeof body.name === 'string' ? body.name : null,
  }
}
