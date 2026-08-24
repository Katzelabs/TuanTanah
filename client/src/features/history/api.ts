import type { MatchHistoryEntry } from '@tuan-tanah/shared'

/**
 * What `GET /api/history` can tell us, as three distinct outcomes rather than a
 * list plus a nullable error. "Signed out" is not a failure — it is the normal
 * state for a guest, and the page says something different for it than for a
 * request that actually broke.
 */
export type HistoryResult =
  | { status: 'ok'; games: MatchHistoryEntry[] }
  | { status: 'signedOut' }
  | { status: 'error' }

/**
 * Deliberately does NOT read the auth store: the session cookie is sent by the
 * browser and the server answers 401 for a guest, so this page needs no client
 * auth state to be correct — and stays independent of subtask B's store.
 * Same-origin in both dev (Vite proxy) and prod (Caddy), so no CORS handling.
 */
export async function fetchMatchHistory(signal?: AbortSignal): Promise<HistoryResult> {
  const res = await fetch('/api/history', { credentials: 'same-origin', signal })
  if (res.status === 401) return { status: 'signedOut' }
  if (!res.ok) return { status: 'error' }
  const body = (await res.json()) as { games?: MatchHistoryEntry[] }
  return { status: 'ok', games: body.games ?? [] }
}
