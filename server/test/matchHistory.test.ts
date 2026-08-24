// The row → entry mapping is the only place match history can quietly lie: every
// field it derives (won, role, wealth) is a decision made about data the archive
// stored for a different purpose. The query around it needs Postgres; this
// doesn't, so it's the part worth pinning down.
import { describe, expect, it } from 'vitest'
import { toMatchHistoryEntry, type MatchHistoryRow } from '../src/persistence/matchHistory.js'

function row(overrides: Partial<MatchHistoryRow> = {}): MatchHistoryRow {
  return {
    gameId: 7,
    playedAt: new Date('2026-08-24T10:00:00.000Z'),
    winnerId: 'p1',
    playerCount: 4,
    playerId: 'p1',
    role: 'pengusaha',
    finalWealth: 12_000_000,
    eliminated: false,
    ...overrides,
  }
}

describe('toMatchHistoryEntry', () => {
  it('reads the win from the archived winner, not from a separate flag', () => {
    expect(toMatchHistoryEntry(row()).won).toBe(true)
    expect(toMatchHistoryEntry(row({ winnerId: 'p2' })).won).toBe(false)
  })

  it('distinguishes losing from being eliminated', () => {
    const eliminated = toMatchHistoryEntry(row({ winnerId: 'p2', eliminated: true }))
    expect(eliminated).toMatchObject({ won: false, eliminated: true })
  })

  it('nulls a role the client could not localize', () => {
    // 'unknown' is what the archive stores for a player who never picked one.
    expect(toMatchHistoryEntry(row({ role: 'unknown' })).role).toBeNull()
    expect(toMatchHistoryEntry(row({ role: 'a-role-we-renamed' })).role).toBeNull()
    expect(toMatchHistoryEntry(row({ role: 'pengacara' })).role).toBe('pengacara')
  })

  it('coerces the bigint wealth `pg` hands back as a string', () => {
    const entry = toMatchHistoryEntry(row({ finalWealth: '12000000' }))
    expect(entry.finalWealth).toBe(12_000_000)
    expect(typeof entry.finalWealth).toBe('number')
  })

  it('serializes the timestamp so the client gets a string, not a Date-shaped object', () => {
    expect(toMatchHistoryEntry(row()).playedAt).toBe('2026-08-24T10:00:00.000Z')
    expect(toMatchHistoryEntry(row({ playedAt: '2026-08-24T10:00:00Z' })).playedAt).toBe(
      '2026-08-24T10:00:00.000Z',
    )
  })
})
