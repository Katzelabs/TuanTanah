// Tuan Tanah backend — Fastify (HTTP) + Socket.io (realtime) bootstrap.
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { Server } from 'socket.io'
import { assertSafeCors, env, isDev } from './env.js'
import { flushSentry, initSentry } from './sentry.js'
import { authEnabled } from '../modules/auth/index.js'
import { registerAuthRoutes } from '../modules/auth/routes.js'
import { authGate } from '../modules/auth/socket.js'
import type { TTServer } from '../realtime/common.js'
import { registerGameHandlers } from '../realtime/game.js'
import { registerLobbyHandlers } from '../realtime/lobby.js'
import { connectionGate, trackConnection } from '../security.js'
import { reportError } from '../observability/report.js'
import { createStore } from '../rooms/store.js'

// Before anything else can fail. `assertSafeCors` throwing on a bad production
// config is itself worth reporting, and it runs on the first line of main().
initSentry()

async function main() {
  assertSafeCors()
  const store = await createStore()

  // Cap request bodies — this API has no large-upload routes, so 64 KB is ample
  // and blocks oversized-payload memory abuse.
  const app = Fastify({ logger: { level: isDev ? 'info' : 'warn' }, bodyLimit: 64 * 1024 })
  await app.register(cors, { origin: env.corsOrigins })
  // Defence-in-depth rate limit for HTTP routes (room creation runs over the
  // socket layer, which has its own limiter in security.ts).
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  // Sign-in routes. Registered whether or not accounts are configured — with
  // blank credentials they simply report accounts as unavailable, and the game
  // stays exactly as guest-playable as it was before this existed.
  await registerAuthRoutes(app)

  // Probes the store on every call rather than reporting `store.backend`, which
  // is fixed at startup and stays 'redis' even when the connection is dead. A
  // 503 makes the container healthcheck fail, so an unreachable store surfaces
  // instead of the process sitting there looking healthy and serving nothing.
  app.get('/api/health', async (_request, reply) => {
    const storeReachable = await store.ping()
    if (!storeReachable) reply.code(503)
    return {
      status: storeReachable ? 'ok' : 'degraded',
      store: store.backend,
      storeReachable,
      uptime: process.uptime(),
    }
  })

  const io: TTServer = new Server(app.server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins },
    // Tiny turn-based payloads — keep the inbound buffer small to bound memory.
    maxHttpBufferSize: 16 * 1024,
    connectTimeout: 20_000,
  })

  // Reject connections over the per-IP / global caps before wiring handlers.
  io.use(connectionGate)
  // Then attach identity. Order matters: no point resolving a session for a
  // handshake the gate is about to refuse. This one never rejects — a socket with
  // no valid cookie is a guest, which is a completely normal way to play.
  io.use(authGate)
  io.on('connection', (socket) => {
    trackConnection(socket)
    registerLobbyHandlers(io, socket, store)
    registerGameHandlers(io, socket, store)
  })

  await app.listen({ port: env.port, host: '0.0.0.0' })
  app.log.info(`Tuan Tanah server ready (store: ${store.backend})`)
  // Worth one line at startup: blank credentials are a supported state, so an
  // accounts feature that is simply switched off looks identical to one that is
  // broken. Say which it is instead of leaving it to be discovered.
  if (authEnabled()) {
    app.log.info(`Accounts enabled (Google OAuth, callback origin: ${env.publicOrigin})`)
  } else if (env.googleClientId && !env.databaseUrl) {
    app.log.warn('Accounts disabled: GOOGLE_CLIENT_ID is set but DATABASE_URL is not')
  } else {
    app.log.info('Accounts disabled (no Google credentials) — guest play only')
  }
}

// Last-resort net for faults with no handler above them — in practice a timer
// path (AFK, auction, time limit) that threw after its socket handler had already
// returned. Node's default since v15 is to treat an unhandled rejection as fatal,
// which would kill every live game in every room over one room's bad await. One
// room failing should not end the others, so this reports and keeps serving.
process.on('unhandledRejection', (reason) => {
  // Unhandled even though the process survives it: nothing in the app caught this,
  // which is the distinction Sentry's crash rate is measuring.
  reportError(reason, { at: 'unhandledRejection' }, { handled: false })
})

// An uncaught exception is different: control flow was interrupted at an unknown
// point, so process state cannot be trusted. Report, then exit and let the
// container's `restart: unless-stopped` bring back a clean one.
process.on('uncaughtException', (err) => {
  reportError(err, { at: 'uncaughtException' }, { handled: false })
  // Drain first: the transport is async, so exiting straight away would drop the
  // one event that explains the crash.
  void flushSentry().finally(() => process.exit(1))
})

main().catch((err) => {
  // Caught here, but the process never comes up — a crash by any useful measure.
  reportError(err, { at: 'startup' }, { handled: false })
  void flushSentry().finally(() => process.exit(1))
})
