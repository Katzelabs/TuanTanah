// The four HTTP routes behind sign-in.
//
//   GET  /api/auth/google           → redirect to Google (@fastify/oauth2)
//   GET  /api/auth/google/callback  → code → userinfo → account → session cookie
//   POST /api/auth/logout           → revoke the session, clear the cookie
//   GET  /api/auth/me               → who the caller is, and whether accounts exist
//
// Same-origin throughout: Vite proxies /api in dev and Caddy does in prod, so the
// session cookie is first-party and no CORS-credentials work is needed.
//
// No auth framework. Auth.js / Lucia / Better Auth each bring their own session
// model and storage adapters, which would have to be reconciled with the Kysely
// schema here and with the Socket.io handshake — more integration than the ~150
// lines that a single provider and an opaque token actually take.
import cookie from '@fastify/cookie'
import oauth2, { type OAuth2Namespace } from '@fastify/oauth2'
import type { FastifyInstance } from 'fastify'
import { env, isDev } from '../../bootstrap/env.js'
import { reportError } from '../../observability/report.js'
import { clearCookieOptions, SESSION_COOKIE, sessionCookieOptions } from './cookie.js'
import {
  fetchGoogleProfile,
  GOOGLE_CALLBACK_PATH,
  googleCallbackUri,
  GOOGLE_SCOPES,
  GOOGLE_START_PATH,
} from './google.js'
import { authEnabled, createSession, destroySession, getUser, resolveSession } from './index.js'
import { upsertGoogleUser } from './users.js'

declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace
  }
}

/** Where the callback drops the browser once the cookie is set. */
const HOME_PATH = '/'

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Registered unconditionally: /api/auth/me must answer even with accounts off,
  // so the client can render guest-only UI instead of guessing from a 404.
  await app.register(cookie)

  app.get('/api/auth/me', async (request, reply) => {
    if (!authEnabled()) return { enabled: false, user: null }

    try {
      const token = request.cookies[SESSION_COOKIE]
      const session = await resolveSession(token)
      if (!session) return { enabled: true, user: null }

      const user = await getUser(session.userId)
      if (!user) {
        // The session outlived the account it points at (deleted elsewhere). Drop
        // both rather than leaving a cookie that resolves to nothing on every load.
        await destroySession(session.sessionId)
        reply.clearCookie(SESSION_COOKIE, clearCookieOptions())
        return { enabled: true, user: null }
      }
      return { enabled: true, user }
    } catch (err) {
      // Redis or Postgres is down. Answering "you are a guest" keeps the game
      // playable through the outage, where a 500 would leave the client with no
      // usable answer at all — but it is still a fault, so it is reported rather
      // than quietly absorbed. The cookie is left alone: the session is probably
      // fine and will resolve again once the store is back.
      reportError(err, { at: 'auth-me' })
      return { enabled: true, user: null }
    }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    try {
      if (token) await destroySession(token)
    } catch (err) {
      // The cookie gets cleared either way — a logout that appears to succeed in
      // the browser but leaves a live session in Redis is the worst outcome here,
      // so the failure has to be visible even though the response stays 200.
      reportError(err, { at: 'auth-logout' })
    }
    reply.clearCookie(SESSION_COOKIE, clearCookieOptions())
    return { ok: true }
  })

  if (!authEnabled()) {
    // Accounts are off, but the client may still be built with a sign-in button.
    // A JSON 404 says "this deployment has no accounts" instead of serving the
    // SPA's index.html to a fetch that expected an OAuth redirect.
    app.get(GOOGLE_START_PATH, async (_request, reply) => {
      reply.code(404)
      return { error: 'Accounts are not enabled on this server' }
    })
    return
  }

  await app.register(oauth2, {
    name: 'googleOAuth2',
    scope: [...GOOGLE_SCOPES],
    credentials: {
      client: { id: env.googleClientId, secret: env.googleClientSecret },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    // Registers GET /api/auth/google, which generates the `state` nonce, stores
    // it in a short-lived cookie, and redirects. The callback below verifies it,
    // which is what stops a third party from replaying an authorization code.
    startRedirectPath: GOOGLE_START_PATH,
    callbackUri: googleCallbackUri(),
    // Online access only: no refresh token is issued, so there is nothing
    // long-lived to store. We need Google exactly once, for one userinfo call.
    callbackUriParams: { access_type: 'online' },
    cookie: { secure: !isDev, sameSite: 'lax', path: '/' },
  })

  app.get(GOOGLE_CALLBACK_PATH, async (request, reply) => {
    try {
      const { token } = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)
      const profile = await fetchGoogleProfile(token.access_token)
      // `token` goes out of scope here and is never persisted — see google.ts.
      const userId = await upsertGoogleUser(profile)
      const sessionToken = await createSession(userId)
      reply.setCookie(SESSION_COOKIE, sessionToken, sessionCookieOptions())
      return reply.redirect(HOME_PATH)
    } catch (err) {
      // A failed sign-in is a fault worth seeing (bad credentials, unreachable
      // Google, a database that rejects the insert) — but the player gets a
      // redirect, not a stack trace, and lands back in a playable guest session.
      reportError(err, { at: 'auth-google-callback' })
      return reply.redirect(`${HOME_PATH}?auth=error`)
    }
  })
}
