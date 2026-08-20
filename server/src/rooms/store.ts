// GameState persistence. Uses Redis when REDIS_URL is reachable, otherwise
// falls back to an in-memory Map so local dev needs no Docker.
import { Redis } from 'ioredis'
import type { GameState } from '@tuan-tanah/shared'
import { env } from '../bootstrap/env.js'

export interface GameStore {
  readonly backend: 'redis' | 'memory'
  get(roomId: string): Promise<GameState | null>
  set(roomId: string, state: GameState): Promise<void>
  del(roomId: string): Promise<void>
  has(roomId: string): Promise<boolean>
  /**
   * Live reachability probe for /api/health. `backend` alone is decided once at
   * startup and stays 'redis' even after the connection dies, so it cannot be
   * used to report health.
   */
  ping(): Promise<boolean>
}

// Bound the health probe so a wedged socket can't stall the healthcheck; the
// container healthcheck allows 5s total.
const PING_TIMEOUT_MS = 1_000

const keyFor = (roomId: string) => `room:${roomId}`
const ttlSeconds = () => Math.max(1, env.roomTtlHours) * 3600

class MemoryStore implements GameStore {
  readonly backend = 'memory' as const
  // Mirror Redis `SET ... EX` semantics so abandoned rooms can't accumulate
  // forever (which would be an unbounded memory leak / DoS surface). TTL is
  // refreshed on every set, and entries expire lazily on read plus an hourly
  // sweep.
  private map = new Map<string, { raw: string; expires: number }>()

  constructor() {
    const sweeper = setInterval(() => this.sweep(), 60 * 60 * 1000)
    sweeper.unref?.()
  }

  private sweep(): void {
    const now = Date.now()
    for (const [key, entry] of this.map) {
      if (entry.expires <= now) this.map.delete(key)
    }
  }

  private live(roomId: string): { raw: string; expires: number } | null {
    const key = keyFor(roomId)
    const entry = this.map.get(key)
    if (!entry) return null
    if (entry.expires <= Date.now()) {
      this.map.delete(key)
      return null
    }
    return entry
  }

  async get(roomId: string): Promise<GameState | null> {
    const entry = this.live(roomId)
    return entry ? (JSON.parse(entry.raw) as GameState) : null
  }
  async set(roomId: string, state: GameState): Promise<void> {
    this.map.set(keyFor(roomId), {
      raw: JSON.stringify(state),
      expires: Date.now() + ttlSeconds() * 1000,
    })
  }
  async del(roomId: string): Promise<void> {
    this.map.delete(keyFor(roomId))
  }
  async has(roomId: string): Promise<boolean> {
    return this.live(roomId) !== null
  }
  // The map is in-process; if we are running at all, it is reachable.
  async ping(): Promise<boolean> {
    return true
  }
}

class RedisStore implements GameStore {
  readonly backend = 'redis' as const
  constructor(private redis: Redis) {}

  async get(roomId: string): Promise<GameState | null> {
    const raw = await this.redis.get(keyFor(roomId))
    return raw ? (JSON.parse(raw) as GameState) : null
  }
  async set(roomId: string, state: GameState): Promise<void> {
    await this.redis.set(keyFor(roomId), JSON.stringify(state), 'EX', ttlSeconds())
  }
  async del(roomId: string): Promise<void> {
    await this.redis.del(keyFor(roomId))
  }
  async has(roomId: string): Promise<boolean> {
    return (await this.redis.exists(keyFor(roomId))) === 1
  }
  async ping(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('redis ping timed out')), PING_TIMEOUT_MS)
      })
      return (await Promise.race([this.redis.ping(), timeout])) === 'PONG'
    } catch {
      return false
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

export async function createStore(): Promise<GameStore> {
  if (!env.redisUrl) {
    console.log('[store] REDIS_URL not set — using in-memory store')
    return new MemoryStore()
  }
  // Flips once the initial connect succeeds. Before that we must NOT retry, so a
  // missing Redis falls straight through to the in-memory store; after it, we must
  // ALWAYS retry, because losing Redis mid-flight is a transient fault, not a
  // reason to wedge the process forever.
  let established = false
  try {
    const redis = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // `() => null` here used to disable reconnection for the whole process
      // lifetime. Recreating the Redis container therefore killed the client
      // permanently: no socket, no retry, and /api/health still said "ok"
      // because it only echoed `backend`. Backoff caps at 5s.
      retryStrategy: (times: number) => (established ? Math.min(times * 200, 5_000) : null),
    })
    // Without an 'error' listener ioredis surfaces connection failures as
    // unhandled events; this also makes reconnects visible in the logs instead
    // of silent.
    redis.on('error', (err: Error) => console.warn('[store] redis error:', err.message))
    redis.on('reconnecting', (delay: number) =>
      console.warn(`[store] redis connection lost — reconnecting in ${delay}ms`),
    )
    redis.on('ready', () => {
      if (established) console.log('[store] redis reconnected')
    })
    await redis.connect()
    await redis.ping()
    established = true
    console.log('[store] connected to Redis')
    return new RedisStore(redis)
  } catch (err) {
    console.warn(
      '[store] Redis unavailable, falling back to in-memory store:',
      (err as Error).message,
    )
    return new MemoryStore()
  }
}
