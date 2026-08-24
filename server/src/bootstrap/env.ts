// Environment configuration with sensible local-dev defaults.
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL?.trim() || '',
  // Postgres for durable game-history archival. Blank = persistence no-ops.
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  // Sentry error tracking. Blank = disabled, same opt-in shape as databaseUrl.
  sentryDsn: process.env.SENTRY_DSN?.trim() || '',
  // Google OAuth for player accounts. Blank = accounts disabled and the game stays
  // fully guest-playable, the same opt-in shape as sentryDsn / databaseUrl.
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
  // Origin the browser reaches this app at. The OAuth redirect URI is built from
  // it and must match what is registered in the Google console byte-for-byte, so
  // any trailing slash is stripped rather than silently producing `//api/...`.
  publicOrigin: (process.env.PUBLIC_ORIGIN?.trim() || 'http://localhost:5173').replace(/\/+$/, ''),
  // Lifetime of a signed-in session. Sliding: refreshed on every use, so this is
  // an idle timeout rather than a hard cap.
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),
  roomTtlHours: Number(process.env.ROOM_TTL_HOURS ?? 24),
  // Allowed CORS origins for the client.
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}

export const isDev = env.nodeEnv !== 'production'

/**
 * Fail fast on an unsafe CORS configuration in production. A wildcard or
 * localhost origin combined with credentialed realtime traffic would let any
 * site drive a player's session, so refuse to start rather than ship it.
 */
export function assertSafeCors(): void {
  if (isDev) return
  const origins = env.corsOrigins
  const unsafe =
    origins.length === 0 ||
    origins.some((o) => o === '*' || o.includes('localhost') || o.includes('127.0.0.1'))
  if (unsafe) {
    throw new Error(
      `Refusing to start: CORS_ORIGINS must be an explicit allowlist of your production origin(s) ` +
        `(got ${JSON.stringify(origins)}). Set CORS_ORIGINS, e.g. https://yourgame.example.`,
    )
  }
}
