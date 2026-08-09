import {
  INVESTOR_RENT_CUT_RATE,
  OJOL_TRANSPORT_BONUS_RATE,
  PENGUSAHA_INCOME_BONUS_RATE,
  PROPERTY_TIERS,
  REGION_SET_VALUE_MULTIPLIER,
  REGIONS,
  ROLE_BONUS_CAP,
  TRANSPORT_BUY_PRICE,
  TRANSPORT_TILE_IDS,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  charge,
  eliminate,
  forfeit,
  playerWealth,
  resolveDebt,
  settleIfAble,
  tileValue,
} from '../src/engine/elimination.js'
import { computeRent, EngineError } from '../src/engine/index.js'
import { addDebt, makeGame, own } from './helpers.js'

describe('tileValue', () => {
  it('values an undeveloped property at its buy price', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    expect(tileValue(state, state.tiles[1]!)).toBe(REGIONS.papua.buyPrice)
  })

  it('values a transport tile at the transport buy price', () => {
    const { state, players } = makeGame(2)
    own(state, 5, players[0]!.id)
    expect(tileValue(state, state.tiles[5]!)).toBe(TRANSPORT_BUY_PRICE)
  })

  it('adds cumulative build costs for a developed property', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id, { track: 'property', tier: 2 })
    const base = REGIONS.papua.buyPrice
    const expected =
      base + base * PROPERTY_TIERS[0]!.buildCostMult + base * PROPERTY_TIERS[1]!.buildCostMult
    expect(tileValue(state, state.tiles[1]!)).toBe(expected)
  })

  it('does not inflate tile value on a full region (set-value bonus removed in Balance Pass v2)', () => {
    const { state, players } = makeGame(2)
    const owner = players[0]!.id
    own(state, 1, owner)
    const single = tileValue(state, state.tiles[1]!)
    expect(single).toBe(REGIONS.papua.buyPrice)
    for (const id of REGIONS.papua.tileIds) own(state, id, owner)
    // REGION_SET_VALUE_MULTIPLIER is now 1 → owning the full region leaves value unchanged.
    expect(tileValue(state, state.tiles[1]!)).toBe(single * REGION_SET_VALUE_MULTIPLIER)
    expect(tileValue(state, state.tiles[1]!)).toBe(single)
  })
})

describe('rent is the weapon (Balance Pass v2)', () => {
  it('lets a developed full-set Villa wall on the cheapest region bankrupt a careless player', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const [owner, victim] = [players[0]!, players[1]!]
    // Owner develops the FULL Papua set (the cheapest region) to Villa / Hotel.
    for (const id of REGIONS.papua.tileIds) own(state, id, owner.id, { track: 'house', tier: 4 })
    // Papua rentBase 0.6jt × Villa ×12 × full-set ×2 = 14.4jt — a one-shot wall.
    const rent = computeRent(state, REGIONS.papua.tileIds[0]!)
    expect(rent).toBe(14_400_000)
    // A careless player sitting under that hit, owning nothing, is wiped out.
    victim.cash = 14_000_000
    state.currentPlayerIndex = 0 // the owner is to-act, so the victim's elimination resolves now
    charge(state, victim, rent, owner.id, 'rent', 'rent', REGIONS.papua.tileIds[0]!)
    expect(victim.isEliminated).toBe(true)
  })
})

describe('playerWealth', () => {
  it('sums cash and owned tile value', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    expect(playerWealth(state, p)).toBe(5_000_000 + REGIONS.papua.buyPrice)
  })
})

describe('charge', () => {
  it('pays immediately when the player can afford it', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    const [payer, owner] = [players[0]!, players[1]!]
    owner.cash = 0
    charge(state, payer, 2_000_000, owner.id, 'rent', 'rent', 1)
    expect(payer.cash).toBe(3_000_000)
    expect(owner.cash).toBe(2_000_000)
    expect(state.pendingDebts).toHaveLength(0)
  })

  it('applies the investor cut on rent (from the bank)', () => {
    const { state, players } = makeGame(3, { cash: 5_000_000, roles: [null, null, 'investor'] })
    const [payer, owner, investor] = [players[0]!, players[1]!, players[2]!]
    investor.cash = 0
    const bankBefore = state.bank
    charge(state, payer, 2_000_000, owner.id, 'rent', 'rent', 1)
    const cut = Math.round(2_000_000 * INVESTOR_RENT_CUT_RATE)
    expect(investor.cash).toBe(cut)
    expect(state.bank).toBe(bankBefore - cut)
  })

  it('pays the Pengusaha a landlord bonus on rent they collect', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000, roles: [null, 'pengusaha'] })
    const [payer, owner] = [players[0]!, players[1]!]
    owner.cash = 0
    own(state, 1, owner.id, { track: 'property', tier: 1 })
    charge(state, payer, 1_000_000, owner.id, 'rent', 'rent', 1)
    const bonus = Math.round(1_000_000 * PENGUSAHA_INCOME_BONUS_RATE)
    expect(owner.cash).toBe(1_000_000 + bonus)
    expect(owner.roleBonusThisLap).toBe(bonus)
  })

  it('pays the Ojol Driver a bonus on rent from their own transport tile', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000, roles: [null, 'ojol_driver'] })
    const [payer, owner] = [players[0]!, players[1]!]
    owner.cash = 0
    const transportTile = TRANSPORT_TILE_IDS[0]!
    own(state, transportTile, owner.id)
    charge(state, payer, 1_000_000, owner.id, 'rent', 'rent', transportTile)
    expect(owner.cash).toBe(1_000_000 + Math.round(1_000_000 * OJOL_TRANSPORT_BONUS_RATE))
  })

  it('pays the Ojol Driver no bonus on non-transport rent', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000, roles: [null, 'ojol_driver'] })
    const [payer, owner] = [players[0]!, players[1]!]
    owner.cash = 0
    own(state, 1, owner.id, { track: 'property', tier: 1 })
    charge(state, payer, 1_000_000, owner.id, 'rent', 'rent', 1)
    expect(owner.cash).toBe(1_000_000)
  })

  it('clamps the investor cut to the per-lap cap', () => {
    const { state, players } = makeGame(3, { cash: 50_000_000, roles: [null, null, 'investor'] })
    const [payer, owner, investor] = [players[0]!, players[1]!, players[2]!]
    investor.cash = 0
    investor.roleBonusThisLap = ROLE_BONUS_CAP - 100_000
    charge(state, payer, 10_000_000, owner.id, 'rent', 'rent', 1)
    // 15% of 10jt = 1.5jt, but only 100k of cap headroom remains this lap.
    expect(investor.cash).toBe(100_000)
    expect(investor.roleBonusThisLap).toBe(ROLE_BONUS_CAP)
  })

  it('opens a pending debt when unaffordable but the player owns property', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    charge(state, p, 2_000_000, null, 'tax', 'luxury tax')
    expect(state.pendingDebts).toHaveLength(1)
    expect(state.pendingDebts[0]!.amount).toBe(2_000_000)
    expect(p.cash).toBe(1_000_000) // untouched until settled
  })

  it('eliminates a player who cannot pay and owns nothing', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    charge(state, p, 2_000_000, null, 'tax', 'luxury tax')
    expect(p.isEliminated).toBe(true)
    expect(state.pendingDebts).toHaveLength(0)
  })
})

describe('eliminate', () => {
  it('reverts tiles + cash to the bank and wipes loans/debts', () => {
    const { state, players } = makeGame(2, { cash: 3_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    own(state, 1, p.id, { track: 'property', tier: 2 })
    p.loans = [
      {
        id: 'l',
        amount: 2_000_000,
        interestPerLap: 0,
        lenderId: null,
        roundBorrowed: 1,
        interestPaid: 0,
      },
    ]
    addDebt(state, { debtorId: p.id, amount: 5_000_000 })
    const bankBefore = state.bank

    eliminate(state, p)

    expect(p.isEliminated).toBe(true)
    expect(p.cash).toBe(0)
    expect(p.loans).toHaveLength(0)
    expect(state.bank).toBe(bankBefore + 3_000_000)
    expect(state.tiles[1]!.ownerId).toBeNull()
    expect(state.tiles[1]!.tier).toBe(0)
    expect(state.pendingDebts).toHaveLength(0)
  })
})

describe('forfeit', () => {
  it('eliminates the leaver and frees their tiles', () => {
    const { state, players } = makeGame(3)
    const leaver = players[1]!
    own(state, 1, leaver.id)

    forfeit(state, leaver.id)

    expect(leaver.isEliminated).toBe(true)
    expect(state.tiles[1]!.ownerId).toBeNull()
  })

  it('advances the turn when the leaver was the current player', () => {
    const { state, players } = makeGame(3)
    state.currentPlayerIndex = 0

    forfeit(state, players[0]!.id)

    // Turn must move off the player who just left so the table doesn't stall.
    expect(state.currentPlayerIndex).not.toBe(0)
    expect(state.players[state.currentPlayerIndex]!.isEliminated).toBe(false)
  })

  it('leaves the turn put when a non-current player forfeits', () => {
    const { state, players } = makeGame(3)
    state.currentPlayerIndex = 0

    forfeit(state, players[2]!.id)

    expect(state.currentPlayerIndex).toBe(0)
  })

  it('is a no-op for an unknown or already-eliminated player', () => {
    const { state, players } = makeGame(2)
    players[0]!.isEliminated = true

    expect(() => forfeit(state, players[0]!.id)).not.toThrow()
    expect(() => forfeit(state, 'nobody')).not.toThrow()
  })
})

describe('settleIfAble', () => {
  it('settles a debt once the player can afford it', () => {
    const { state, players } = makeGame(2, { cash: 3_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000, creditorId: null, type: 'rent' })
    settleIfAble(state, p.id)
    expect(state.pendingDebts).toHaveLength(0)
    expect(p.cash).toBe(1_000_000)
  })

  it('eliminates the player if still short with nothing left to sell', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    settleIfAble(state, p.id)
    expect(p.isEliminated).toBe(true)
  })
})

describe('resolveDebt', () => {
  it('eliminates the player when they give up', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    resolveDebt(state, p.id, true)
    expect(p.isEliminated).toBe(true)
  })

  it('pays off the debt when the player can afford it', () => {
    const { state, players } = makeGame(2, { cash: 3_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    resolveDebt(state, p.id, false)
    expect(state.pendingDebts).toHaveLength(0)
    expect(p.cash).toBe(1_000_000)
  })

  it('throws when still short but the player still owns sellable property', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    expect(() => resolveDebt(state, p.id, false)).toThrow(EngineError)
  })

  it('throws when there is no outstanding debt', () => {
    const { state, players } = makeGame(2)
    expect(() => resolveDebt(state, players[0]!.id, false)).toThrow(EngineError)
  })
})
