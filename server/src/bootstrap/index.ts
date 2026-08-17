// Tuan Tanah backend — Fastify (HTTP) + Socket.io (realtime) bootstrap.
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@tuan-tanah/shared'
import { assertSafeCors, env, isDev } from './env.js'
import { registerGameHandlers } from '../realtime/game.js'
import { registerLobbyHandlers } from '../realtime/lobby.js'
import { connectionGate, trackConnection } from '../security.js'
import { reportError } from '../observability/report.js'
import { createStore } from '../rooms/store.js'

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

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins },
    // Tiny turn-based payloads — keep the inbound buffer small to bound memory.
    maxHttpBufferSize: 16 * 1024,
    connectTimeout: 20_000,
  })

  // Reject connections over the per-IP / global caps before wiring handlers.
  io.use(connectionGate)
  io.on('connection', (socket) => {
    trackConnection(socket)
    registerLobbyHandlers(io, socket, store)
    registerGameHandlers(io, socket, store)
  })

  await app.listen({ port: env.port, host: '0.0.0.0' })
  app.log.info(`Tuan Tanah server ready (store: ${store.backend})`)
}

// Last-resort net for faults with no handler above them — in practice a timer
// path (AFK, auction, time limit) that threw after its socket handler had already
// returned. Node's default since v15 is to treat an unhandled rejection as fatal,
// which would kill every live game in every room over one room's bad await. One
// room failing should not end the others, so this reports and keeps serving.
process.on('unhandledRejection', (reason) => {
  reportError(reason, { at: 'unhandledRejection' })
})

// An uncaught exception is different: control flow was interrupted at an unknown
// point, so process state cannot be trusted. Report, then exit and let the
// container's `restart: unless-stopped` bring back a clean one.
process.on('uncaughtException', (err) => {
  reportError(err, { at: 'uncaughtException' })
  process.exit(1)
})

main().catch((err) => {
  reportError(err, { at: 'startup' })
  process.exit(1)
})
