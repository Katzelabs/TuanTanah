// Per-player disconnect grace timers. Mirrors the AFK clock in afk.ts: the
// wall-clock lives here (the engine stays pure) while the effect of an expiry —
// release the seat, move the room-master role — is `applyDisconnectGrace`.
//
// A socket disconnect no longer means "gone". The seat is marked dropped and a
// timer is armed; reconnecting inside the window cancels it and the player is
// simply back, with the same seat and the same state. Only when the window
// closes does the room act on the absence.
//
// Unlike the AFK timer there is one timer per *player*, not per room: several
// players can be inside their grace window at once.
import { DISCONNECT_GRACE_MS } from '@tuan-tanah/shared'
import type { GameState } from '@tuan-tanah/shared'
import { applyDisconnectGrace } from '../engine/index.js'
import { mutateRoom } from '../rooms/rooms.js'
import { reportError } from '../observability/report.js'
import type { GameStore } from '../rooms/store.js'
import { clearAfkTimer, TIMER_SLACK_MS } from './afk.js'
import { broadcastState, type TTServer } from './common.js'
import { clearRoomTimer } from './gameOver.js'

const graceTimers = new Map<string, Map<string, NodeJS.Timeout>>()

export function clearDisconnectGrace(roomId: string, playerId: string): void {
  const room = graceTimers.get(roomId)
  const timer = room?.get(playerId)
  if (timer) clearTimeout(timer)
  room?.delete(playerId)
  if (room && room.size === 0) graceTimers.delete(roomId)
}

/** Drop every pending grace timer for a room (it ended, or it's being deleted). */
export function clearRoomGraceTimers(roomId: string): void {
  const room = graceTimers.get(roomId)
  if (!room) return
  for (const timer of room.values()) clearTimeout(timer)
  graceTimers.delete(roomId)
}

/**
 * Start (or restart) the grace countdown for a dropped seat. The caller has
 * already marked the player disconnected; this only schedules the consequence.
 */
export function armDisconnectGrace(
  io: TTServer,
  store: GameStore,
  roomId: string,
  playerId: string,
  delayMs: number = DISCONNECT_GRACE_MS,
): void {
  clearDisconnectGrace(roomId, playerId)
  const timer = setTimeout(() => {
    // Nothing sits above a timer to catch a throw — unhandled, this would reach
    // the process-level handler and the room would silently keep a dead seat.
    void resolveDisconnectGrace(io, store, roomId, playerId).catch((err) =>
      reportError(err, { at: 'resolveDisconnectGrace', roomId, playerId }),
    )
  }, delayMs + TIMER_SLACK_MS)
  timer.unref?.()
  const room = graceTimers.get(roomId) ?? new Map<string, NodeJS.Timeout>()
  room.set(playerId, timer)
  graceTimers.set(roomId, room)
}

/**
 * Fired when a dropped player's grace window closes. `applyDisconnectGrace`
 * re-checks the deadline against state, so a reconnect that raced the timer (or a
 * duplicate call from the lazy sweep) is a no-op rather than a lost seat.
 */
export async function resolveDisconnectGrace(
  io: TTServer,
  store: GameStore,
  roomId: string,
  playerId: string,
): Promise<void> {
  clearDisconnectGrace(roomId, playerId)
  const outcome = await mutateRoom(store, roomId, (state) => {
    applyDisconnectGrace(state, playerId)
    return { empty: state.players.length === 0, remainingMs: graceRemaining(state, playerId) }
  }).catch((err) => {
    // Deleting a room clears its grace timers, and the room TTL is orders of
    // magnitude longer than the grace window — so a room missing here is genuinely
    // unexpected, and the seat it was holding is now stuck. Worth a report.
    reportError(err, { at: 'resolveDisconnectGrace.mutate', roomId, playerId })
    return { empty: false, remainingMs: 0 }
  })

  // The timer fired but the seat's deadline hasn't quite passed, so
  // `applyDisconnectGrace` rightly declined to act. A timer measures elapsed time
  // while the deadline is compared against `Date.now()`, and the two drift —
  // landing a millisecond early is normal. Without this the seat would sit there
  // until something else happened to sweep it, which is exactly the "player is
  // stuck in a room they already left" symptom this whole path exists to fix.
  if (outcome.remainingMs > 0) {
    armDisconnectGrace(io, store, roomId, playerId, outcome.remainingMs)
    return
  }

  if (outcome.empty) {
    await deleteRoom(store, roomId)
    return
  }
  await broadcastState(io, store, roomId)
}

/** Milliseconds left on a seat's grace window; 0 once it's up (or not waiting). */
function graceRemaining(state: GameState, playerId: string): number {
  const p = state.players.find((x) => x.id === playerId)
  if (!p || p.isConnected || p.disconnectedAt == null) return 0
  return Math.max(0, p.disconnectedAt + DISCONNECT_GRACE_MS - Date.now())
}

/**
 * Delete a room and everything scheduled against it. Called when the last seat
 * goes — otherwise an abandoned lobby would sit in the store until its TTL, and
 * its timers would keep firing at nobody.
 */
export async function deleteRoom(store: GameStore, roomId: string): Promise<void> {
  clearRoomGraceTimers(roomId)
  clearAfkTimer(roomId)
  clearRoomTimer(roomId)
  await store.del(roomId).catch((err) => reportError(err, { at: 'deleteRoom', roomId }))
}
