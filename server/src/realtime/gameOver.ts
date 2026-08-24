// Game-over funnel: a single place that resolves win conditions, broadcasts the
// final state, and emits `game_over`. Both the per-room time-limit timer and the
// end_turn handler call `concludeIfWon`, so the resolution path is identical
// whether the game ends by inactivity or by a player's action.
import type { UserId } from '@tuan-tanah/shared'
import { finalStandings, resolveGameOver } from '../engine/index.js'
import { mutateRoom } from '../rooms/rooms.js'
import { reportError } from '../observability/report.js'
import { getSession } from '../rooms/sessions.js'
import type { GameStore } from '../rooms/store.js'
import { persistGameResult, type AccountAttribution } from '../persistence/gameHistory.js'
import { clearAfkTimer } from './afk.js'
import { broadcastState, type TTServer } from './common.js'

// Per-room time-limit timers. Cleared when the game ends or is rescheduled.
const roomTimers = new Map<string, NodeJS.Timeout>()

export function clearRoomTimer(roomId: string): void {
  const timer = roomTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomTimers.delete(roomId)
  }
}

/**
 * Check the room's win condition; if the game just ended, clear its timer,
 * broadcast the final state, and emit `game_over` with the standings.
 */
export async function concludeIfWon(io: TTServer, store: GameStore, roomId: string): Promise<void> {
  const now = Date.now()
  const ended = await mutateRoom(store, roomId, (state) => resolveGameOver(state, now))
  if (!ended) return
  clearRoomTimer(roomId)
  clearAfkTimer(roomId)
  await broadcastState(io, store, roomId)
  const state = await store.get(roomId)
  if (!state || !state.winner) return
  io.to(roomId).emit('game_over', {
    winner: state.winner,
    finalStandings: finalStandings(state),
  })
  // Fire-and-forget: archive completed-game stats (no-op unless DATABASE_URL is set).
  await persistGameResult(state, now, await accountsInRoom(io, roomId))
}

/**
 * Which seats were being played by a signed-in account, read from the sockets
 * still in the room at game-over.
 *
 * Deliberately a snapshot, not a ledger: a player who joined as a guest and
 * signed in mid-game is credited, one who signed out is not, and one who closed
 * the tab before the final turn is archived anonymously. Tracking identity
 * changes across a whole game would buy a rare edge case at the cost of state
 * that has to stay correct through every reconnect.
 *
 * Attribution failing must not break the end of a game, so a bad adapter read
 * costs the archive its user_ids and nothing else.
 */
async function accountsInRoom(io: TTServer, roomId: string): Promise<AccountAttribution> {
  const accounts = new Map<string, UserId>()
  try {
    for (const socket of await io.in(roomId).fetchSockets()) {
      const session = getSession(socket.id)
      if (session?.userId) accounts.set(session.playerId, session.userId)
    }
  } catch (err) {
    reportError(err, { at: 'accountsInRoom', roomId })
  }
  return accounts
}

/**
 * Schedule the time-limit wakeup for a room that just started. The timer is a
 * safety net for inactivity — `concludeIfWon` recomputes from `startedAt`, so a
 * little clock drift is harmless.
 */
export async function scheduleTimeLimit(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  const state = await store.get(roomId)
  if (!state) return
  const { timeLimitMinutes } = state.settings
  if (!timeLimitMinutes) return

  clearRoomTimer(roomId)
  const timer = setTimeout(() => {
    // Nothing is above a timer to catch this — without the handler the game would
    // simply never end, and no trace of why.
    void concludeIfWon(io, store, roomId).catch((err) =>
      reportError(err, { at: 'timeLimitTimer', roomId }),
    )
  }, timeLimitMinutes * 60_000)
  timer.unref?.()
  roomTimers.set(roomId, timer)
}
