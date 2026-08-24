// Read side of the game archive: the games one account has played.
//
// The archive itself is not new — `gameHistory.ts` has been writing `games` +
// `game_players` since before accounts existed. All that changed is that a row
// can now name the account that played it (`game_players.user_id`, migration
// 0002), which is what makes this query possible at all. Rows with a null
// user_id are guest games and belong to nobody, so they are simply never matched.
import { ROLES, type MatchHistoryEntry, type Role, type UserId } from '@tuan-tanah/shared'
import { getDb } from './db.js'

/** How many games one request will return. Deliberately not paginated yet. */
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/** One joined `game_players` × `games` row, before it becomes a history entry. */
export interface MatchHistoryRow {
  gameId: number
  playedAt: Date | string
  winnerId: string
  playerCount: number
  playerId: string
  role: string
  // bigint in Postgres: `pg` hands int8 back as a string rather than risk a
  // silent precision loss, so this is NOT reliably a number the way the
  // insert-only type in schema.ts suggests. Coerced below, not trusted here.
  finalWealth: number | string
  eliminated: boolean
}

function asRole(role: string): Role | null {
  // The archive stores 'unknown' for a player who never picked one, and older
  // rows predate any role we might rename — anything unrecognised reads as null
  // rather than being handed to the client as a Role it can't localize.
  return role in ROLES ? (role as Role) : null
}

/** Pure row → entry mapping, kept separate so it can be tested without Postgres. */
export function toMatchHistoryEntry(row: MatchHistoryRow): MatchHistoryEntry {
  return {
    gameId: row.gameId,
    playedAt: new Date(row.playedAt).toISOString(),
    role: asRole(row.role),
    finalWealth: Number(row.finalWealth),
    eliminated: row.eliminated,
    // There is exactly one winner per archived game, and `winner_id` holds the
    // per-game playerId — so this is a comparison, not a second query.
    won: row.winnerId === row.playerId,
    playerCount: row.playerCount,
  }
}

/**
 * The account's most recent finished games, newest first. Returns an empty list
 * when Postgres is unconfigured (`DATABASE_URL` blank) — the same opt-in shape
 * the rest of persistence has, so a dev box without a database sees the empty
 * state instead of an error.
 *
 * Unlike the write path this one does NOT swallow failures: no live game is at
 * risk here, and a route that quietly returns "no games played" when the query
 * is broken is worse than one that says it failed.
 */
export async function getMatchHistory(
  userId: UserId,
  limit = DEFAULT_LIMIT,
): Promise<MatchHistoryEntry[]> {
  const db = getDb()
  if (!db) return []

  const rows = await db
    .selectFrom('game_players as gp')
    .innerJoin('games as g', 'g.id', 'gp.game_id')
    .where('gp.user_id', '=', userId)
    .select([
      'g.id as gameId',
      'g.created_at as playedAt',
      'g.winner_id as winnerId',
      'g.player_count as playerCount',
      'gp.player_id as playerId',
      'gp.role as role',
      'gp.final_wealth as finalWealth',
      'gp.eliminated as eliminated',
    ])
    .orderBy('g.created_at', 'desc')
    .limit(Math.min(Math.max(1, limit), MAX_LIMIT))
    .execute()

  return rows.map(toMatchHistoryEntry)
}
