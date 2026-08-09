import {
  BOARD,
  INFLUENCER_SALARY_CAP,
  INFLUENCER_SALARY_STEP,
  REGIONS,
  ROLES,
  type GameState,
  type Player,
  type Role,
  type TileState,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { playerWealth, salaryFor, taxMultiplier } from './playerMath.js'

function makeTiles(): TileState[] {
  return BOARD.map((t) => ({
    id: t.id,
    ownerId: null,
    track: null,
    tier: 0,
    builderId: null,
    landBuild: null,
    priceMultiplier: 1,
  }))
}

function makePlayer(role: Role | null, cash = 0): Player {
  return {
    id: 'p1',
    name: 'P1',
    color: '#fff',
    role,
    cash,
    position: 0,
    inJail: false,
  } as Player
}

/** Only the fields the two helpers read: `round` and `tiles`. */
function makeState(round: number, tiles: TileState[] = makeTiles()): GameState {
  return { round, tiles } as GameState
}

describe('salaryFor', () => {
  it('returns the role base salary', () => {
    expect(salaryFor(makeState(1), makePlayer('pejabat'))).toBe(ROLES.pejabat.salary)
  })

  it('returns 0 for a player with no role', () => {
    expect(salaryFor(makeState(1), makePlayer(null))).toBe(0)
  })

  it('grows the Influencer salary once per round past the first', () => {
    const base = ROLES.influencer.salary
    expect(salaryFor(makeState(1), makePlayer('influencer'))).toBe(base)
    expect(salaryFor(makeState(3), makePlayer('influencer'))).toBe(
      base + INFLUENCER_SALARY_STEP * 2,
    )
  })

  it('caps the Influencer salary', () => {
    expect(salaryFor(makeState(999), makePlayer('influencer'))).toBe(INFLUENCER_SALARY_CAP)
  })
})

describe('taxMultiplier', () => {
  it('halves tax for an Ojol Driver and leaves everyone else at full rate', () => {
    expect(taxMultiplier(makePlayer('ojol_driver'))).toBe(0.5)
    expect(taxMultiplier(makePlayer('pejabat'))).toBe(1)
    expect(taxMultiplier(makePlayer(null))).toBe(1)
  })
})

describe('playerWealth', () => {
  it('is cash on hand when the player owns nothing', () => {
    expect(playerWealth(makeState(1), makePlayer('sales', 5_000_000))).toBe(5_000_000)
  })

  it('adds the market value of owned tiles only', () => {
    const tiles = makeTiles()
    tiles[1]!.ownerId = 'p1' // Papua
    tiles[2]!.ownerId = 'p2' // someone else's
    const state = makeState(1, tiles)
    expect(playerWealth(state, makePlayer('sales', 1_000_000))).toBe(
      1_000_000 + REGIONS.papua.buyPrice,
    )
  })
})
