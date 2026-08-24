// history — the signed-in player's finished games (ClickUp 86eyqjv4x, subtask E).
//
// A feature seam like `../auth` and `../social`: the HTTP surface lives here, the
// Postgres query lives in `persistence/matchHistory.ts`. Nothing in the game
// engine or the realtime layer knows this route exists — history is read from the
// archive that game-over already writes.
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { UserId } from '@tuan-tanah/shared'
import { reportError } from '../../observability/report.js'
import { getMatchHistory } from '../../persistence/matchHistory.js'

/**
 * Name of the opaque session cookie subtask A issues.
 *
 * A owns the cookie; the contract in `modules/auth/index.ts` exposes only
 * `resolveSession(token)`, not the name it arrives under, and widening that
 * contract from this branch is exactly what the parallel-ticket rules forbid. So
 * the name is pinned here — one constant to reconcile when A merges, rather than
 * a cookie-parsing routine copied into every route that needs a viewer.
 */
const SESSION_COOKIE = 'tt_session'

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    // A malformed cookie is a client problem, not a 500. Hand back the raw value
    // and let session lookup fail on it like any other bad token.
    return value
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() !== name) continue
    return decode(part.slice(eq + 1).trim())
  }
  return undefined
}

/**
 * The account behind this request, or null for a guest.
 *
 * The auth module is imported *lazily* on purpose. Until subtask A lands it is
 * declarations only, so at runtime it exports nothing — a static
 * `import { resolveSession }` would fail to link and take the whole server down
 * on startup. A dynamic import gives back a namespace with the export missing
 * instead, which reads as "no session": everyone is a guest, which is a state
 * this feature has to handle anyway. When A merges, this code needs no change.
 */
async function viewerId(request: FastifyRequest): Promise<UserId | null> {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE)
  if (!token) return null
  const { resolveSession } = await import('../auth/index.js')
  if (typeof resolveSession !== 'function') return null
  const session = await resolveSession(token)
  return session?.userId ?? null
}

export function registerHistoryRoutes(app: FastifyInstance): void {
  // The viewer's own recent games. There is no route for anyone else's history —
  // a player's results are theirs, and nothing in the game needs to read them.
  app.get('/api/history', async (request, reply) => {
    const userId = await viewerId(request)
    if (!userId) {
      reply.code(401)
      return { error: 'unauthenticated' }
    }

    try {
      return { games: await getMatchHistory(userId) }
    } catch (err) {
      // Worth reporting: unlike the archival write path, nothing downstream
      // covers for this, and a history page that is permanently empty because
      // the query is broken looks exactly like a player who never finished a game.
      reportError(err, { at: 'GET /api/history' })
      reply.code(500)
      return { error: 'unavailable' }
    }
  })
}
