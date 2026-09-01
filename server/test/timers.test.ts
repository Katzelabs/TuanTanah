// The server clocks' wiring — not the rules they enforce (that's afk.test.ts and
// win.test.ts), but what happens when a timer fires at the wrong moment.
//
// Every clock here compares a `Date.now()` deadline against a timer that counts
// elapsed time, and the two can disagree: a wall clock that steps backward (WSL2
// and VMs do this on host resync) leaves a timer landing just short of the deadline
// it exists to enforce. That is not hypothetical — it was caught in a live run of
// the disconnect-grace clock, which is built the same way (see presence.test.ts).
// Each handler must wait out the remainder rather than spend its timer for nothing.
import { AFK_FINE_STEP, AFK_TIMEOUT_MS, AUCTION_TIMEOUT_MS } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  clearAfkTimer,
  clearAuctionTimer,
  resolveAfk,
  resolveAuctionAfk,
} from '../src/realtime/afk.js'
import { clearRoomTimer, hasRoomTimer, resolveTimeLimit } from '../src/realtime/gameOver.js'
import { liveStore, makeGame, own, recordingIo } from './helpers.js'

describe('resolveAfk', () => {
  it('skips the idle player once the deadline has passed', async () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    state.turn.deadline = Date.now() - 1_000
    const rec = recordingIo()

    await resolveAfk(rec.io, liveStore(state), state.roomId)

    expect(players[0]!.afkStrikes).toBe(1)
    expect(players[0]!.cash).toBe(100_000_000 - AFK_FINE_STEP)
    expect(state.currentPlayerIndex).toBe(1)
    clearAfkTimer(state.roomId)
  })

  it('waits out the remainder instead of gifting a fresh turn clock', async () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    // A second still to go: the timer fired early.
    const deadline = Date.now() + 1_000
    state.turn.deadline = deadline
    const rec = recordingIo()

    await resolveAfk(rec.io, liveStore(state), state.roomId)

    expect(players[0]!.afkStrikes).toBe(0)
    expect(state.currentPlayerIndex).toBe(0)
    // The regression: falling through to `broadcastAndArm` would have pushed the
    // deadline out by a whole AFK_TIMEOUT_MS, doubling the idle player's turn.
    expect(state.turn.deadline).toBe(deadline)
    expect(state.turn.deadline).toBeLessThan(Date.now() + AFK_TIMEOUT_MS)
    expect(rec.broadcasts).toBe(0)
    clearAfkTimer(state.roomId)
  })
})

describe('resolveAuctionAfk', () => {
  function withAuction(deadline: number) {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    own(state, 5, players[1]!.id)
    state.pendingAuction = {
      tileId: 5,
      attackerId: players[0]!.id,
      ownerId: players[1]!.id,
      currentBid: 10_000_000,
      highBidderId: players[0]!.id,
      history: [{ playerId: players[0]!.id, amount: 10_000_000 }],
      deadline,
    }
    return { state, players }
  }

  it('settles the auction for the high bidder once the deadline has passed', async () => {
    const { state, players } = withAuction(Date.now() - 1_000)
    const rec = recordingIo()

    await resolveAuctionAfk(rec.io, liveStore(state), state.roomId)

    expect(state.pendingAuction).toBeNull()
    expect(state.tiles[5]!.ownerId).toBe(players[0]!.id)
    clearAuctionTimer(state.roomId)
    clearAfkTimer(state.roomId)
  })

  it('keeps the auction alive when it fires early, rather than freezing the table', async () => {
    const { state } = withAuction(Date.now() + 1_000)
    const rec = recordingIo()

    await resolveAuctionAfk(rec.io, liveStore(state), state.roomId)

    // A live auction makes the turn clock ineligible and only a bid re-arms the
    // auction clock, so dropping it here used to leave the table waiting forever.
    expect(state.pendingAuction).not.toBeNull()
    expect(state.pendingAuction!.deadline).toBeLessThan(Date.now() + AUCTION_TIMEOUT_MS)
    expect(rec.broadcasts).toBe(0)
    clearAuctionTimer(state.roomId)
  })
})

describe('resolveTimeLimit', () => {
  /** A live game whose clock has `msLeft` to run (negative = already over). */
  function gameWithClock(msLeft: number) {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    state.settings.timeLimitMinutes = 60
    state.startedAt = Date.now() - (60 * 60_000 - msLeft)
    return { state, players }
  }

  it('ends the game once the clock has genuinely run out', async () => {
    const { state } = gameWithClock(-1_000)
    const rec = recordingIo()

    await resolveTimeLimit(rec.io, liveStore(state), state.roomId)

    expect(state.phase).toBe('ended')
    expect(state.winReason).toBe('time')
    expect(hasRoomTimer(state.roomId)).toBe(false)
    clearRoomTimer(state.roomId)
  })

  it('puts the timer back when it fires early instead of spending it', async () => {
    const { state } = gameWithClock(5_000)
    const rec = recordingIo()

    await resolveTimeLimit(rec.io, liveStore(state), state.roomId)

    expect(state.phase).toBe('playing')
    // The regression: this is the room's only time-limit timer and it is armed
    // once, at kickoff. Giving up here left a paused table running past its limit
    // with nothing left to end it.
    expect(hasRoomTimer(state.roomId)).toBe(true)
    clearRoomTimer(state.roomId)
  })
})
