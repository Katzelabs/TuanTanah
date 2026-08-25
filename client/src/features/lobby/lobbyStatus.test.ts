import { ALL_ROLES, type Role } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { canStartGame, startBlockers, type LobbyPlayer } from './lobbyStatus.js'

const settings = (enabledRoles: Role[] = ALL_ROLES) => ({ enabledRoles })

const player = (over: Partial<LobbyPlayer> & { name: string }): LobbyPlayer => ({
  role: null,
  isConnected: true,
  ...over,
})

describe('lobbyStatus', () => {
  it('blocks a room that is one player short', () => {
    const players = [player({ name: 'Budi', role: 'sales' })]
    expect(canStartGame(players)).toBe(false)
    expect(startBlockers(players, settings())).toEqual([{ kind: 'needPlayers', missing: 1 }])
  })

  it('names the players still choosing a role', () => {
    const players = [
      player({ name: 'Budi', role: 'sales' }),
      player({ name: 'Sari' }),
      player({ name: 'Tono' }),
    ]
    expect(canStartGame(players)).toBe(false)
    expect(startBlockers(players, settings())).toEqual([
      { kind: 'needRoles', names: ['Sari', 'Tono'] },
    ])
  })

  it('ignores disconnected players, exactly like the engine does', () => {
    // Two connected players with roles start the game even though a third
    // dropped out mid-pick — the engine filters on `isConnected` too.
    const players = [
      player({ name: 'Budi', role: 'sales' }),
      player({ name: 'Sari', role: 'pejabat' }),
      player({ name: 'Ghost', isConnected: false }),
    ]
    expect(canStartGame(players)).toBe(true)
    expect(startBlockers(players, settings())).toEqual([])
  })

  it('calls out a room with fewer free roles than players waiting', () => {
    const players = [
      player({ name: 'Budi', role: 'sales' }),
      player({ name: 'Sari' }),
      player({ name: 'Tono' }),
    ]
    // Only `sales` is on — and Budi already holds it, so nobody else can pick.
    const blockers = startBlockers(players, settings(['sales']))
    expect(blockers).toContainEqual({ kind: 'notEnoughRoles', enabled: 1, players: 3 })
  })

  it('counts a role held by a disconnected player as taken', () => {
    const players = [
      player({ name: 'Budi', role: 'sales' }),
      player({ name: 'Sari' }),
      player({ name: 'Ghost', role: 'pejabat', isConnected: false }),
    ]
    // Two roles on, both already spoken for — Sari has nothing left to claim.
    expect(startBlockers(players, settings(['sales', 'pejabat']))).toContainEqual({
      kind: 'notEnoughRoles',
      enabled: 2,
      players: 2,
    })
  })

  it('agrees with canStartGame in every case', () => {
    const cases: LobbyPlayer[][] = [
      [],
      [player({ name: 'Budi', role: 'sales' })],
      [player({ name: 'Budi', role: 'sales' }), player({ name: 'Sari' })],
      [player({ name: 'Budi', role: 'sales' }), player({ name: 'Sari', role: 'pejabat' })],
    ]
    for (const players of cases) {
      expect(startBlockers(players, settings()).length === 0).toBe(canStartGame(players))
    }
  })
})
