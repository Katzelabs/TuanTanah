// Room invites (ClickUp subtask G). Two things here can't be caught anywhere
// else: the join-blocker a stale invite resolves to (getting "room full" when
// the game has actually started sends the player chasing the wrong fix), and
// the per-recipient invite budget that stops an invite becoming a spam channel.
import { MAX_PLAYERS } from '@tuan-tanah/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { addPlayer, createGameState, startGame } from '../src/engine/index.js'
import { BLOCKER_ERROR_CODE, roomJoinability, type JoinBlocker } from '../src/rooms/joinability.js'
import {
  claimInviteBudget,
  MAX_INVITES_PER_ROOM_PER_RECIPIENT,
  resetInviteBudgets,
} from '../src/modules/invites/index.js'
import type { GameStore } from '../src/rooms/store.js'
import type { GameState } from '@tuan-tanah/shared'

function storeWith(state: GameState | null): GameStore {
  return {
    backend: 'memory',
    get: async () => state,
    set: async () => undefined,
    del: async () => undefined,
    has: async () => state !== null,
    ping: async () => true,
  }
}

function lobbyWith(count: number): GameState {
  const state = createGameState('ROOM01', 0)
  for (let i = 0; i < count; i++) addPlayer(state, `P${i + 1}`)
  return state
}

describe('roomJoinability', () => {
  it('accepts a lobby with room to spare', async () => {
    expect(await roomJoinability(storeWith(lobbyWith(2)), 'ROOM01')).toEqual({
      joinable: true,
      reason: null,
    })
  })

  it('distinguishes a vanished room from a full or started one', async () => {
    const gone = await roomJoinability(storeWith(null), 'NOPE01')
    expect(gone).toEqual({ joinable: false, reason: 'missing' })

    const full = await roomJoinability(storeWith(lobbyWith(MAX_PLAYERS)), 'ROOM01')
    expect(full).toEqual({ joinable: false, reason: 'full' })

    const state = lobbyWith(2)
    state.players.forEach((p, i) => (p.role = i === 0 ? 'pengusaha' : 'investor'))
    startGame(state, state.players[0]!.id)
    const started = await roomJoinability(storeWith(state), 'ROOM01')
    expect(started).toEqual({ joinable: false, reason: 'started' })
  })

  it('reports a started game as started even when it is also full', async () => {
    // Order matters: a full, in-progress game is not going to empty out into a
    // joinable lobby, so "already started" is the useful half of the truth.
    const state = lobbyWith(MAX_PLAYERS)
    state.players.forEach((p, i) => (p.role = i === 0 ? 'pengusaha' : null))
    state.phase = 'playing'
    expect(await roomJoinability(storeWith(state), 'ROOM01')).toEqual({
      joinable: false,
      reason: 'started',
    })
  })

  it('maps every blocker to a localized error code', () => {
    const blockers: JoinBlocker[] = ['missing', 'started', 'full']
    for (const blocker of blockers) expect(BLOCKER_ERROR_CODE[blocker]).toMatch(/^invites\./)
  })
})

describe('claimInviteBudget', () => {
  beforeEach(() => resetInviteBudgets())

  it('allows a few invites then stops', () => {
    for (let i = 0; i < MAX_INVITES_PER_ROOM_PER_RECIPIENT; i++) {
      expect(claimInviteBudget('ROOM01', 'friend-a')).toBe(true)
    }
    expect(claimInviteBudget('ROOM01', 'friend-a')).toBe(false)
  })

  it('budgets each recipient and each room separately', () => {
    for (let i = 0; i < MAX_INVITES_PER_ROOM_PER_RECIPIENT; i++) {
      claimInviteBudget('ROOM01', 'friend-a')
    }
    expect(claimInviteBudget('ROOM01', 'friend-b')).toBe(true)
    expect(claimInviteBudget('ROOM02', 'friend-a')).toBe(true)
  })

  it('refills once the window has passed', () => {
    const t0 = 1_000_000
    for (let i = 0; i < MAX_INVITES_PER_ROOM_PER_RECIPIENT; i++) {
      claimInviteBudget('ROOM01', 'friend-a', t0)
    }
    expect(claimInviteBudget('ROOM01', 'friend-a', t0)).toBe(false)
    expect(claimInviteBudget('ROOM01', 'friend-a', t0 + 61 * 60 * 1000)).toBe(true)
  })
})
