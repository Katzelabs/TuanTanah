// Opaque session tokens: `sess:<id>` → userId, with a TTL.
//
// Deliberately not a JWT. There is no signing secret to manage or rotate, the
// token carries no claims to go stale, and revoking a session is a DEL rather
// than a denylist we would have to keep and check forever.
//
// Redis is the real backend. When REDIS_URL is blank — the supported no-Docker
// local-dev state, same as rooms/store.ts — this falls back to an in-process Map
// so sign-in still works; sessions just don't survive a restart. Mirroring that
// module's shape rather than borrowing its client keeps auth from depending on
// room storage: they have different lifetimes and, eventually, different scaling.
import { randomBytes } from 'node:crypto'
import { Redis } from 'ioredis'
import { env } from '../../bootstrap/env.js'

const keyFor = (id: string) => `sess:${id}`

const DEFAULT_TTL_DAYS = 30

/**
 * How long a session lives, in seconds. Also drives the cookie's `maxAge`, so it
 * is exported rather than duplicated — a cookie that outlives its Redis key logs
 * the player out with no sign of why. A non-numeric SESSION_TTL_DAYS falls back
 * to the default instead of becoming a NaN TTL that Redis rejects outright.
 */
export function sessionTtlSeconds(): number {
  const days = Number.isFinite(env.sessionTtlDays) ? env.sessionTtlDays : DEFAULT_TTL_DAYS
  return Math.max(1, Math.round(days)) * 24 * 3600
}

interface SessionBackend {
  /** Returns the userId and slides the TTL forward, or null if absent/expired. */
  touch(id: string): Promise<string | null>
  put(id: string, userId: string): Promise<void>
  drop(id: string): Promise<void>
}

class MemorySessionBackend implements SessionBackend {
  private map = new Map<string, { userId: string; expires: number }>()

  constructor() {
    // Expiry is lazy on read; this sweep stops tokens that are never looked up
    // again from accumulating for the life of the process.
    const sweeper = setInterval(
      () => {
        const now = Date.now()
        for (const [key, entry] of this.map) {
          if (entry.expires <= now) this.map.delete(key)
        }
      },
      60 * 60 * 1000,
    )
    sweeper.unref?.()
  }

  async touch(id: string): Promise<string | null> {
    const key = keyFor(id)
    const entry = this.map.get(key)
    if (!entry) return null
    if (entry.expires <= Date.now()) {
      this.map.delete(key)
      return null
    }
    entry.expires = Date.now() + sessionTtlSeconds() * 1000
    return entry.userId
  }

  async put(id: string, userId: string): Promise<void> {
    this.map.set(keyFor(id), { userId, expires: Date.now() + sessionTtlSeconds() * 1000 })
  }

  async drop(id: string): Promise<void> {
    this.map.delete(keyFor(id))
  }
}

class RedisSessionBackend implements SessionBackend {
  constructor(private redis: Redis) {}

  async touch(id: string): Promise<string | null> {
    const key = keyFor(id)
    // GETEX reads and slides the TTL in one round trip, so a session expires on
    // idleness rather than on a fixed date — sign in once, stay signed in while
    // you keep playing.
    const userId = await this.redis.getex(key, 'EX', sessionTtlSeconds())
    return userId ?? null
  }

  async put(id: string, userId: string): Promise<void> {
    await this.redis.set(keyFor(id), userId, 'EX', sessionTtlSeconds())
  }

  async drop(id: string): Promise<void> {
    await this.redis.del(keyFor(id))
  }
}

let backendPromise: Promise<SessionBackend> | null = null

async function connect(): Promise<SessionBackend> {
  if (!env.redisUrl) {
    console.warn('[auth] REDIS_URL not set — sessions are in-memory and end with the process')
    return new MemorySessionBackend()
  }
  // Same two-phase retry policy as rooms/store.ts: never retry the first connect
  // (so a missing Redis falls straight through to memory instead of hanging the
  // first sign-in), always retry afterwards (a dropped connection is transient).
  let established = false
  try {
    const redis = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => (established ? Math.min(times * 200, 5_000) : null),
    })
    // Logged, not `reportError`d — same call as rooms/store.ts. ioredis emits
    // this on every reconnect attempt, so a Redis restart would fire hundreds of
    // identical events; the connection recovers on its own, and the thing worth
    // reporting is a request that actually failed, which the callers do.
    redis.on('error', (err: Error) => console.warn('[auth] session redis error:', err.message))
    await redis.connect()
    await redis.ping()
    established = true
    return new RedisSessionBackend(redis)
  } catch (err) {
    console.warn(
      '[auth] Redis unavailable for sessions, falling back to in-memory:',
      (err as Error).message,
    )
    return new MemorySessionBackend()
  }
}

// Memoised on the promise, not the resolved value, so concurrent first calls
// share one connection attempt instead of racing to open several clients.
function backend(): Promise<SessionBackend> {
  backendPromise ??= connect()
  return backendPromise
}

/** 256 bits of entropy, url-safe. Long enough that guessing is not a threat model. */
function newSessionId(): string {
  return randomBytes(32).toString('base64url')
}

export async function putSession(userId: string): Promise<string> {
  const id = newSessionId()
  await (await backend()).put(id, userId)
  return id
}

export async function readSession(id: string): Promise<string | null> {
  return (await backend()).touch(id)
}

export async function dropSession(id: string): Promise<void> {
  await (await backend()).drop(id)
}
