// Socket identity: read the session cookie off the handshake and hang the
// account id on the socket, so realtime handlers know who is connected without
// re-reading Redis on every event.
//
// Runs alongside `connectionGate` in ../../security.ts, and is deliberately much
// weaker than it: the gate rejects connections, this one never does. A guest with
// no cookie is a first-class player, and an expired cookie means "play as a
// guest", not "you are locked out mid-game".
import type { UserId } from '@tuan-tanah/shared'
import { reportError } from '../../observability/report.js'
import { readSessionCookie } from './cookie.js'
import { authEnabled, resolveSession } from './index.js'

/**
 * Per-socket data. `userId` is absent for guests — every account-gated handler
 * must treat that as the normal case, not an error.
 */
export interface AuthSocketData {
  userId?: UserId
}

/**
 * The slice of a Socket.io socket this middleware touches. Structural rather than
 * `Socket<…>` so `realtime/common.ts` can own the fully-parameterised socket type
 * without the two modules importing each other in a circle.
 */
interface IdentifiableSocket {
  id: string
  handshake: { headers: { cookie?: string } }
  data: AuthSocketData
}

/**
 * Socket.io connection middleware (`io.use`). Always calls `next()`: identity is
 * additive here, and a Redis hiccup during the handshake must degrade a player to
 * a guest rather than refuse them a seat.
 */
export function authGate(socket: IdentifiableSocket, next: (err?: Error) => void): void {
  if (!authEnabled()) {
    next()
    return
  }

  const token = readSessionCookie(socket.handshake.headers.cookie)
  if (!token) {
    next()
    return
  }

  resolveSession(token)
    .then((session) => {
      if (session) socket.data.userId = session.userId
    })
    .catch((err: unknown) => reportError(err, { at: 'auth-socket-gate', socketId: socket.id }))
    .finally(() => next())
}
