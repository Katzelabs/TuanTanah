// Abuse / DoS controls for the realtime layer: per-IP connection caps and a
// per-socket event-rate limiter. Game traffic is turn-based and the payloads are
// tiny, so these limits are generous enough never to affect legitimate play
// while stopping a single client from flooding events or opening unbounded
// connections. State is in-process (per server instance), which is sufficient
// for a coarse first line of defence; a horizontally-scaled deployment would
// move these counters to Redis.
import type { Socket } from 'socket.io'

// Concurrent connections allowed from one client IP. Generous so players sharing
// a NAT/office IP aren't locked out, but bounded against trivial abuse.
const MAX_CONNECTIONS_PER_IP = 50
// Total concurrent connections across this instance (coarse memory backstop).
const MAX_TOTAL_CONNECTIONS = 5000

// Per-socket token bucket: sustained throughput + short burst allowance. A
// normal turn fires only a handful of events, so this is far above real use.
const BUCKET_CAPACITY = 40 // burst allowance
const REFILL_PER_SEC = 15 // sustained events/sec
const MAX_STRIKES = 20 // disconnect a socket after this many throttled events

const connectionsByIp = new Map<string, number>()
let totalConnections = 0

/**
 * Best-effort client IP from a raw `X-Forwarded-For` header plus the direct peer
 * address.
 *
 * Behind the platform edge the direct peer is the proxy, so without this every
 * player shares one address — which turns any per-IP limit into a global one.
 * We honour the first XFF hop the edge sets and fall back to the peer when there
 * is no proxy. (XFF is only trustworthy when a trusted proxy sets it — that's the
 * documented deployment.)
 *
 * Exported because the HTTP side needs exactly the same answer: `security.ts`
 * owns this decision so the socket limiter and the feedback route's rate limit
 * cannot key on two different notions of "who is this".
 */
export function clientIpFrom(xff: string | string[] | undefined, peer: string | undefined): string {
  const header = Array.isArray(xff) ? xff[0] : xff
  if (typeof header === 'string' && header.length > 0) {
    const first = header.split(',')[0]?.trim()
    if (first) return first
  }
  return peer || 'unknown'
}

function clientIp(socket: Socket): string {
  return clientIpFrom(socket.handshake.headers['x-forwarded-for'], socket.handshake.address)
}

/**
 * Socket.io connection middleware (`io.use`): reject handshakes that exceed the
 * per-IP or global concurrency caps before any game handler is wired up.
 */
export function connectionGate(socket: Socket, next: (err?: Error) => void): void {
  if (totalConnections >= MAX_TOTAL_CONNECTIONS) {
    next(new Error('Server is at capacity, please try again later'))
    return
  }
  const ip = clientIp(socket)
  if ((connectionsByIp.get(ip) ?? 0) >= MAX_CONNECTIONS_PER_IP) {
    next(new Error('Too many connections from your network'))
    return
  }
  next()
}

/**
 * Count a live connection, attach the per-socket event-rate limiter, and release
 * the counts on disconnect. Call once per socket inside `io.on('connection')`.
 */
export function trackConnection(socket: Socket): void {
  const ip = clientIp(socket)
  connectionsByIp.set(ip, (connectionsByIp.get(ip) ?? 0) + 1)
  totalConnections++

  let tokens = BUCKET_CAPACITY
  let last = Date.now()
  let strikes = 0

  socket.use((_packet, nextEvent) => {
    const now = Date.now()
    tokens = Math.min(BUCKET_CAPACITY, tokens + ((now - last) / 1000) * REFILL_PER_SEC)
    last = now
    if (tokens < 1) {
      strikes++
      socket.emit('error', { message: 'You are sending requests too quickly' })
      // Drop the event (don't call nextEvent) so its handler never runs.
      if (strikes >= MAX_STRIKES) socket.disconnect(true)
      return
    }
    tokens -= 1
    nextEvent()
  })

  socket.on('disconnect', () => {
    totalConnections = Math.max(0, totalConnections - 1)
    const remaining = (connectionsByIp.get(ip) ?? 1) - 1
    if (remaining <= 0) connectionsByIp.delete(ip)
    else connectionsByIp.set(ip, remaining)
  })
}
