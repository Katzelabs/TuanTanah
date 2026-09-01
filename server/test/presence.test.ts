// Disconnect grace + room-master handover (ClickUp 86eyr3nb0).
//
// The rules here only ever run behind a wall-clock timer, so this is the only
// place the awkward cases get exercised: a host who blips for five seconds must
// keep the room, a host who leaves for good must not keep it hostage, and a seat
// must never be released twice (the timer and the lazy sweep both fire at it).
import { DISCONNECT_GRACE_MS } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  applyDisconnectGrace,
  reassignRoomMaster,
  removePlayer,
  setConnected,
  startGame,
  sweepExpiredGrace,
} from '../src/engine/index.js'
import { clearRoomGraceTimers, resolveDisconnectGrace } from '../src/realtime/presence.js'
import { liveStore, makeGame, recordingIo, seqRng } from './helpers.js'

const PAST = DISCONNECT_GRACE_MS + 1

describe('reassignRoomMaster', () => {
  it('leaves a present room master alone', () => {
    const { state, players } = makeGame(3, { lobby: true })
    expect(reassignRoomMaster(state)).toBeNull()
    expect(players[0]!.isRoomMaster).toBe(true)
  })

  it('moves the role to the oldest player who can actually host', () => {
    const { state, players } = makeGame(4, { lobby: true })
    // P1 (the host) and P2 are gone; P3 is out. P4 is the oldest that can host.
    setConnected(state, players[0]!.id, false)
    setConnected(state, players[1]!.id, false)
    players[2]!.isEliminated = true

    expect(reassignRoomMaster(state)).toBe(players[3]!.id)
    expect(players[0]!.isRoomMaster).toBe(false)
    expect(players[3]!.isRoomMaster).toBe(true)
    // Exactly one master, always.
    expect(state.players.filter((p) => p.isRoomMaster)).toHaveLength(1)
  })

  it('keeps the role where it is when nobody can host', () => {
    const { state, players } = makeGame(2, { lobby: true })
    for (const p of players) setConnected(state, p.id, false)

    expect(reassignRoomMaster(state)).toBeNull()
    expect(players[0]!.isRoomMaster).toBe(true)
  })

  it('does not hand the role back when the original host returns', () => {
    const { state, players } = makeGame(2, { lobby: true })
    setConnected(state, players[0]!.id, false)
    reassignRoomMaster(state)
    expect(players[1]!.isRoomMaster).toBe(true)

    setConnected(state, players[0]!.id, true)
    reassignRoomMaster(state)
    expect(players[1]!.isRoomMaster).toBe(true)
    expect(players[0]!.isRoomMaster).toBe(false)
  })

  it('logs the handover so the room can see why the crown moved', () => {
    const { state, players } = makeGame(2, { lobby: true })
    setConnected(state, players[0]!.id, false)
    reassignRoomMaster(state)

    expect(state.log.at(-1)?.code).toBe('core.roomMasterHandover')
    expect(state.log.at(-1)?.params).toMatchObject({ name: players[1]!.name })
  })
})

describe('applyDisconnectGrace', () => {
  it('does nothing while the player is still inside the window', () => {
    const { state, players } = makeGame(3, { lobby: true })
    setConnected(state, players[0]!.id, false, 0)

    applyDisconnectGrace(state, players[0]!.id, DISCONNECT_GRACE_MS - 1)
    expect(state.players).toHaveLength(3)
    expect(players[0]!.isRoomMaster).toBe(true)
  })

  it('does nothing for a player who reconnected in time', () => {
    const { state, players } = makeGame(3, { lobby: true })
    setConnected(state, players[0]!.id, false, 0)
    setConnected(state, players[0]!.id, true, 10)

    applyDisconnectGrace(state, players[0]!.id, PAST)
    expect(state.players).toHaveLength(3)
    expect(players[0]!.disconnectedAt).toBeNull()
    expect(players[0]!.isRoomMaster).toBe(true)
  })

  it('releases a lobby seat once the window closes, handing over the room', () => {
    const { state, players } = makeGame(3, { lobby: true })
    setConnected(state, players[0]!.id, false, 0)

    applyDisconnectGrace(state, players[0]!.id, PAST)
    expect(state.players.map((p) => p.id)).toEqual([players[1]!.id, players[2]!.id])
    expect(players[1]!.isRoomMaster).toBe(true)
  })

  it('keeps a seat in a live game and only moves the room master', () => {
    const { state, players } = makeGame(3)
    setConnected(state, players[0]!.id, false, 0)

    applyDisconnectGrace(state, players[0]!.id, PAST)
    // Removing a player mid-game would tear up turn order and tile ownership —
    // an absent player is the AFK clock's problem, not this one's.
    expect(state.players).toHaveLength(3)
    expect(players[0]!.isConnected).toBe(false)
    expect(players[1]!.isRoomMaster).toBe(true)
  })

  it('is idempotent — the timer and the sweep can both fire at one seat', () => {
    const { state, players } = makeGame(3)
    setConnected(state, players[0]!.id, false, 0)

    applyDisconnectGrace(state, players[0]!.id, PAST)
    const logLength = state.log.length
    applyDisconnectGrace(state, players[0]!.id, PAST + 10_000)

    expect(state.players).toHaveLength(3)
    expect(state.log).toHaveLength(logLength)
  })
})

describe('sweepExpiredGrace', () => {
  it('clears every expired seat at once without tripping over its own splices', () => {
    const { state, players } = makeGame(4, { lobby: true })
    setConnected(state, players[0]!.id, false, 0)
    setConnected(state, players[1]!.id, false, 0)
    setConnected(state, players[2]!.id, false, PAST) // still inside its window

    sweepExpiredGrace(state, PAST)
    expect(state.players.map((p) => p.id)).toEqual([players[2]!.id, players[3]!.id])
    // P3 survives the sweep but is still offline, so the crown skips past them to
    // P4 — handing it to someone inside their own grace window would leave the
    // room hostless anyway.
    expect(players[2]!.isRoomMaster).toBe(false)
    expect(players[3]!.isRoomMaster).toBe(true)
  })
})

describe('removePlayer', () => {
  it('skips a disconnected player when handing over the room', () => {
    const { state, players } = makeGame(3, { lobby: true })
    setConnected(state, players[1]!.id, false)

    removePlayer(state, players[0]!.id)
    expect(players[1]!.isRoomMaster).toBe(false)
    expect(players[2]!.isRoomMaster).toBe(true)
  })
})

describe('startGame', () => {
  it('drops seats that are still disconnected at the whistle', () => {
    const { state, players } = makeGame(3, {
      lobby: true,
      roles: ['sales', 'kontraktor', 'rentenir'],
    })
    // Dropped inside the grace window: connected players still meet the minimum,
    // so without the drop this role-less ghost would be dealt in.
    setConnected(state, players[2]!.id, false)

    startGame(state, players[0]!.id, seqRng([1]))
    expect(state.players.map((p) => p.id)).toEqual([players[0]!.id, players[1]!.id])
    expect(state.phase).toBe('playing')
  })
})

describe('resolveDisconnectGrace', () => {
  it('releases the seat and broadcasts once the window has closed', async () => {
    const { state, players } = makeGame(2, { lobby: true })
    setConnected(state, players[0]!.id, false, Date.now() - DISCONNECT_GRACE_MS - 1_000)
    const rec = recordingIo()

    await resolveDisconnectGrace(rec.io, liveStore(state), state.roomId, players[0]!.id)

    expect(state.players.map((p) => p.name)).toEqual([players[1]!.name])
    expect(players[1]!.isRoomMaster).toBe(true)
    expect(rec.broadcasts).toBe(1)
  })

  it('waits out the remainder instead of dropping the seat when the clock disagrees', async () => {
    // Regression: the timer fires on elapsed time, the deadline is a Date.now()
    // stamp, and the two can disagree — a timer landing even a millisecond short
    // used to make this a silent no-op that still broadcast, leaving the seat
    // stuck until something else swept it. It must re-arm, not shrug.
    const { state, players } = makeGame(2, { lobby: true })
    setConnected(state, players[0]!.id, false, Date.now() - DISCONNECT_GRACE_MS + 1_000)
    const rec = recordingIo()

    await resolveDisconnectGrace(rec.io, liveStore(state), state.roomId, players[0]!.id)

    expect(state.players).toHaveLength(2)
    expect(players[0]!.isRoomMaster).toBe(true)
    // Nothing changed, so nothing to tell the room about.
    expect(rec.broadcasts).toBe(0)
    clearRoomGraceTimers(state.roomId)
  })
})
