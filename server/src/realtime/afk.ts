// Per-room AFK auto-skip timer. Mirrors the time-limit timer in gameOver.ts: the
// wall-clock lives here (the engine stays pure), while the effect of a timeout —
// fine / skip / kick — is the pure `applyAfkTimeout` engine function.
//
// The active player's turn carries a `turn.deadline` (epoch ms). Every action
// re-broadcasts state, and each broadcast goes through `broadcastAndArm`, which
// pushes the deadline forward and reschedules the timer — so the countdown resets
// whenever the active player does anything. When the timer fires with the deadline
// still in the past, the current player is auto-skipped.
import { AFK_TIMEOUT_MS, AUCTION_TIMEOUT_MS } from '@tuan-tanah/shared'
import type { GameState } from '@tuan-tanah/shared'
import { applyAfkTimeout, resolveAuctionTimeout } from '../engine/index.js'
import { mutateRoom } from '../rooms/rooms.js'
import { reportError } from '../observability/report.js'
import type { GameStore } from '../rooms/store.js'
import { broadcastState, type TTServer } from './common.js'
import { concludeIfWon } from './gameOver.js'

// Per-room AFK timers. Cleared when re-armed, when the game ends, or when the
// game pauses (debt/vote) so an idle clock can't fire on a paused table.
const roomAfkTimers = new Map<string, NodeJS.Timeout>()

/**
 * Timers count elapsed time; every deadline here is a `Date.now()` stamp. The two
 * disagree — a wall clock that steps backward (or plain scheduling jitter) can
 * land a timer just short of the deadline it exists to enforce. Arm slightly long,
 * and re-arm rather than shrug if a fire still turns out to be early.
 */
export const TIMER_SLACK_MS = 250

/** Milliseconds left on a deadline stamp; 0 once it has passed. */
function remainingOn(deadline: number): number {
  return Math.max(0, deadline - Date.now())
}

export function clearAfkTimer(roomId: string): void {
  const timer = roomAfkTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomAfkTimers.delete(roomId)
  }
}

/** Whether an AFK timer should be running: a live, unpaused turn with an active player. */
function afkEligible(state: GameState): boolean {
  if (state.phase !== 'playing') return false
  if (state.pendingDebts.length > 0) return false
  if (state.pendingVote) return false
  if (state.pendingAuction) return false
  const current = state.players[state.currentPlayerIndex]
  return !!current && !current.isEliminated
}

/**
 * Set the current turn's `deadline` and (re)schedule the room's AFK timer. No-op
 * effect when the game isn't in a skippable turn — in that case the deadline is
 * cleared so the client hides the countdown.
 */
export async function armAfk(io: TTServer, store: GameStore, roomId: string): Promise<void> {
  const eligible = await mutateRoom(store, roomId, (state) => {
    if (!afkEligible(state)) {
      state.turn.deadline = null
      return false
    }
    state.turn.deadline = Date.now() + AFK_TIMEOUT_MS
    return true
  }).catch((err) => {
    // Falling back to "not eligible" keeps the table alive, but silently losing
    // the reason is how a room ends up with no clock and nobody knowing why.
    reportError(err, { at: 'armAfk', roomId })
    return false
  })

  clearAfkTimer(roomId)
  if (!eligible) return
  scheduleAfk(io, store, roomId, AFK_TIMEOUT_MS)
}

/**
 * Schedule the room's AFK wakeup without touching the deadline. Kept separate from
 * `armAfk` because a re-arm after a premature fire must NOT push the deadline
 * forward — that would hand the idle player a whole extra turn clock.
 */
function scheduleAfk(io: TTServer, store: GameStore, roomId: string, delayMs: number): void {
  clearAfkTimer(roomId)
  const timer = setTimeout(() => {
    // A timer fires with no socket handler above it, so nothing else would catch
    // this. Unhandled, it would reach the process-level handler in bootstrap/.
    void resolveAfk(io, store, roomId).catch((err) =>
      reportError(err, { at: 'resolveAfk', roomId }),
    )
  }, delayMs + TIMER_SLACK_MS)
  timer.unref?.()
  roomAfkTimers.set(roomId, timer)
}

/** Arm the AFK timer, then broadcast — so clients receive the fresh deadline. */
export async function broadcastAndArm(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  await armAfk(io, store, roomId)
  await broadcastState(io, store, roomId)
}

// Per-room force-buy auction timers. A live auction pauses the normal turn clock
// (see `afkEligible`); this separate timer concedes for the to-act bidder if they
// stall, so the table can't freeze. Re-armed on every bid, cleared on resolution.
const roomAuctionTimers = new Map<string, NodeJS.Timeout>()

export function clearAuctionTimer(roomId: string): void {
  const timer = roomAuctionTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomAuctionTimers.delete(roomId)
  }
}

/**
 * Set the live auction's `deadline` and (re)schedule its concede-on-timeout timer.
 * No-op when no auction is live. Call after opening an auction or accepting a bid.
 */
export async function armAuction(io: TTServer, store: GameStore, roomId: string): Promise<void> {
  const armed = await mutateRoom(store, roomId, (state) => {
    if (!state.pendingAuction || state.phase !== 'playing') return false
    state.pendingAuction.deadline = Date.now() + AUCTION_TIMEOUT_MS
    return true
  }).catch((err) => {
    reportError(err, { at: 'armAuction', roomId })
    return false
  })

  clearAuctionTimer(roomId)
  if (!armed) return
  scheduleAuction(io, store, roomId, AUCTION_TIMEOUT_MS)
}

/** Schedule the auction wakeup without touching its deadline (see `scheduleAfk`). */
function scheduleAuction(io: TTServer, store: GameStore, roomId: string, delayMs: number): void {
  clearAuctionTimer(roomId)
  const timer = setTimeout(() => {
    void resolveAuctionAfk(io, store, roomId).catch((err) =>
      reportError(err, { at: 'resolveAuctionAfk', roomId }),
    )
  }, delayMs + TIMER_SLACK_MS)
  timer.unref?.()
  roomAuctionTimers.set(roomId, timer)
}

/**
 * Fired when the to-act bidder runs out the auction clock. Re-checks the deadline
 * (a bid may have re-armed it → no-op), resolves the auction for the high bidder,
 * then re-arms the normal turn clock and resolves any win condition.
 */
export async function resolveAuctionAfk(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  const retryIn = await mutateRoom(store, roomId, (state) => {
    const auction = state.pendingAuction
    if (!auction || auction.deadline === null) return 0
    const remaining = remainingOn(auction.deadline)
    if (remaining > 0) return remaining
    resolveAuctionTimeout(state)
    return 0
  }).catch((err) => {
    reportError(err, { at: 'resolveAuctionAfk.mutate', roomId })
    return 0
  })

  // Fired early. This one cannot be shrugged off: a live auction makes the turn
  // clock ineligible, and nothing but a bid re-arms the auction clock — so
  // dropping it here would freeze the table until someone happened to bid.
  if (retryIn > 0) {
    scheduleAuction(io, store, roomId, retryIn)
    return
  }

  clearAuctionTimer(roomId)
  await broadcastAndArm(io, store, roomId)
  await concludeIfWon(io, store, roomId)
}

/**
 * Fired when a turn runs out the inactivity clock. Re-checks the deadline (an
 * action may have re-armed it in the meantime → no-op), auto-skips the current
 * player, then re-arms for the next player and resolves any win condition.
 */
export async function resolveAfk(io: TTServer, store: GameStore, roomId: string): Promise<void> {
  const nothing = { eliminated: [] as string[], retryIn: 0 }
  const outcome = await mutateRoom(store, roomId, (state) => {
    if (!afkEligible(state)) return nothing
    const { deadline } = state.turn
    if (deadline === null) return nothing
    const remaining = remainingOn(deadline)
    if (remaining > 0) return { eliminated: [] as string[], retryIn: remaining }
    const current = state.players[state.currentPlayerIndex]
    if (!current) return nothing
    const before = state.players.filter((p) => p.isEliminated).map((p) => p.id)
    applyAfkTimeout(state, current.id)
    return {
      eliminated: state.players
        .filter((p) => p.isEliminated && !before.includes(p.id))
        .map((p) => p.id),
      retryIn: 0,
    }
  }).catch((err) => {
    // The skip did not happen. The table is about to be re-broadcast as if it
    // had, so this is the one report that explains a stuck turn.
    reportError(err, { at: 'resolveAfk.mutate', roomId })
    return nothing
  })

  // Fired early: wait out what's left rather than falling through to
  // `broadcastAndArm`, which would reset the deadline and quietly gift the idle
  // player a second full turn clock.
  if (outcome.retryIn > 0) {
    scheduleAfk(io, store, roomId, outcome.retryIn)
    return
  }

  await broadcastAndArm(io, store, roomId)
  for (const id of outcome.eliminated) io.to(roomId).emit('player_eliminated', { playerId: id })
  await concludeIfWon(io, store, roomId)
}
