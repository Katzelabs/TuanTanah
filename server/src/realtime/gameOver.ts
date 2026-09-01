// Game-over funnel: a single place that resolves win conditions, broadcasts the
// final state, and emits `game_over`. Both the per-room time-limit timer and the
// end_turn handler call `concludeIfWon`, so the resolution path is identical
// whether the game ends by inactivity or by a player's action.
import type { GameState, UserId } from '@tuan-tanah/shared'
import { finalStandings, resolveGameOver } from '../engine/index.js'
import { mutateRoom } from '../rooms/rooms.js'
import { reportError } from '../observability/report.js'
import { getSession } from '../rooms/sessions.js'
import type { GameStore } from '../rooms/store.js'
import { persistGameResult, type AccountAttribution } from '../persistence/gameHistory.js'
import { clearAfkTimer, TIMER_SLACK_MS } from './afk.js'
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

/** Is a time-limit wakeup currently scheduled for this room? */
export function hasRoomTimer(roomId: string): boolean {
  return roomTimers.has(roomId)
}

/** Milliseconds left on the room's time limit; 0 once it's up (or there is none). */
function timeLimitRemaining(state: GameState): number {
  const { timeLimitMinutes } = state.settings
  if (!timeLimitMinutes || !state.startedAt) return 0
  return Math.max(0, state.startedAt + timeLimitMinutes * 60_000 - Date.now())
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
  if (!state.settings.timeLimitMinutes) return
  scheduleTimeLimitTimer(io, store, roomId, timeLimitRemaining(state))
}

/** Schedule the wakeup itself. Split out so the resolver can put a timer back. */
function scheduleTimeLimitTimer(
  io: TTServer,
  store: GameStore,
  roomId: string,
  delayMs: number,
): void {
  clearRoomTimer(roomId)
  const timer = setTimeout(() => {
    // Nothing is above a timer to catch this — without the handler the game would
    // simply never end, and no trace of why.
    void resolveTimeLimit(io, store, roomId).catch((err) =>
      reportError(err, { at: 'timeLimitTimer', roomId }),
    )
  }, delayMs + TIMER_SLACK_MS)
  timer.unref?.()
  roomTimers.set(roomId, timer)
}

/**
 * Fired when the room's clock should have run out. Ends the game if it really has
 * — and puts the timer back if it hasn't.
 *
 * That second half matters more here than anywhere else. A timer counts elapsed
 * time while `checkWinCondition` compares `startedAt` against `Date.now()`, and a
 * wall clock that steps backward can leave this firing early (see TIMER_SLACK_MS
 * in afk.ts). This is the room's ONLY time-limit timer and it is armed once, at
 * kickoff — so an early fire that simply gave up would spend it. Ordinary play
 * would still end the game, since `concludeIfWon` runs from end_turn, the AFK skip
 * and elimination; but a table paused on a debt, vote or auction runs no clock at
 * all, and would sit past its limit indefinitely.
 */
export async function resolveTimeLimit(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  await concludeIfWon(io, store, roomId)
  const state = await store.get(roomId)
  if (!state || state.phase !== 'playing') return
  const remaining = timeLimitRemaining(state)
  if (remaining > 0) scheduleTimeLimitTimer(io, store, roomId, remaining)
}
