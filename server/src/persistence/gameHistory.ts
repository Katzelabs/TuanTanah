// Final game-history persistence (tech doc §9: `games` + `game_players`). Silently
// no-ops when Postgres is unconfigured, and never throws — persistence failures
// must not disrupt the live game. `now` is the game-over wall-clock (epoch ms),
// used to compute play duration. Reimplemented on Kysely/Postgres (was Supabase).
import type { GameState } from '@tuan-tanah/shared'
import { playerWealth } from '../engine/index.js'
import { reportError } from '../observability/report.js'
import { getDb } from './db.js'

export async function persistGameResult(state: GameState, now: number): Promise<void> {
  const db = getDb()
  if (!db) return
  if (!state.winner) return

  try {
    const game = await db
      .insertInto('games')
      .values({
        room_id: state.roomId,
        winner_id: state.winner,
        win_condition: state.winReason ?? null,
        duration_seconds: state.startedAt ? Math.round((now - state.startedAt) / 1000) : null,
        player_count: state.players.length,
      })
      .returning('id')
      .executeTakeFirst()

    if (!game) {
      reportError(new Error('games insert returned no id'), {
        at: 'persistGameResult',
        roomId: state.roomId,
      })
      return
    }

    await db
      .insertInto('game_players')
      .values(
        state.players.map((p) => ({
          game_id: game.id,
          player_id: p.id,
          role: p.role ?? 'unknown',
          final_cash: p.cash,
          final_wealth: playerWealth(state, p),
          eliminated: p.isEliminated,
        })),
      )
      .execute()
  } catch (err) {
    // Still swallowed — archival must never disrupt a live game, and that part of
    // the contract is deliberate. What was wrong is that it was also invisible: a
    // `console.warn` into rotated Docker logs nobody reads means a permanently
    // broken archive looks exactly like a run of games nobody finished. Reported
    // now, and still not rethrown.
    reportError(err, { at: 'persistGameResult', roomId: state.roomId })
  }
}
