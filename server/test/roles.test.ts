import {
  INFLUENCER_SALARY_CAP,
  INFLUENCER_SALARY_STEP,
  INVESTOR_RENT_CUT_RATE,
  ROLE_BONUS_CAP,
  ROLES,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  awardRoleBonus,
  buildCostMultiplier,
  buyPriceMultiplier,
  investorCut,
  salaryFor,
  taxMultiplier,
} from '../src/engine/roles.js'
import { rollDice, sendToJail } from '../src/engine/index.js'
import { makeGame } from './helpers.js'

describe('salaryFor', () => {
  it('returns the role base salary', () => {
    const { state, players } = makeGame(1, { roles: ['pengacara'] })
    expect(salaryFor(state, players[0]!)).toBe(ROLES.pengacara.salary)
  })

  it("grows the Influencer's salary each round up to the cap", () => {
    const { state, players } = makeGame(1, { roles: ['influencer'] })
    const p = players[0]!
    state.round = 1
    expect(salaryFor(state, p)).toBe(ROLES.influencer.salary)
    state.round = 4
    expect(salaryFor(state, p)).toBe(ROLES.influencer.salary + 3 * INFLUENCER_SALARY_STEP)
    state.round = 100
    expect(salaryFor(state, p)).toBe(INFLUENCER_SALARY_CAP)
  })

  it('returns 0 when no role is picked', () => {
    const { state, players } = makeGame(1)
    expect(salaryFor(state, players[0]!)).toBe(0)
  })
})

describe('buyPriceMultiplier', () => {
  it('discounts the Sales role by 20%', () => {
    const { players } = makeGame(1, { roles: ['sales'] })
    expect(buyPriceMultiplier(players[0]!)).toBe(0.8)
  })

  it('is full price for other roles', () => {
    const { players } = makeGame(1, { roles: ['investor'] })
    expect(buyPriceMultiplier(players[0]!)).toBe(1)
  })
})

describe('buildCostMultiplier', () => {
  it('discounts the Kontraktor by 50% and is full for others', () => {
    const { players } = makeGame(2, { roles: ['kontraktor', 'pengusaha'] })
    expect(buildCostMultiplier(players[0]!)).toBe(0.5)
    expect(buildCostMultiplier(players[1]!)).toBe(1)
  })
})

describe('investorCut', () => {
  it('skims the investor rate', () => {
    expect(investorCut(2_000_000)).toBe(Math.round(2_000_000 * INVESTOR_RENT_CUT_RATE))
  })
})

describe('taxMultiplier', () => {
  it('halves tax for the Ojol Driver and is full for others', () => {
    const { players } = makeGame(2, { roles: ['ojol_driver', 'pengusaha'] })
    expect(taxMultiplier(players[0]!)).toBe(0.5)
    expect(taxMultiplier(players[1]!)).toBe(1)
  })
})

describe('awardRoleBonus', () => {
  it('pays from the bank and tracks the per-lap total', () => {
    const { state, players } = makeGame(1, { cash: 0, roles: ['investor'] })
    const p = players[0]!
    const bankBefore = state.bank
    expect(awardRoleBonus(state, p, 500_000)).toBe(500_000)
    expect(p.cash).toBe(500_000)
    expect(p.roleBonusThisLap).toBe(500_000)
    expect(state.bank).toBe(bankBefore - 500_000)
  })

  it('clamps to the remaining per-lap cap and stops at 0', () => {
    const { state, players } = makeGame(1, { cash: 0, roles: ['investor'] })
    const p = players[0]!
    p.roleBonusThisLap = ROLE_BONUS_CAP - 300_000
    expect(awardRoleBonus(state, p, 1_000_000)).toBe(300_000)
    expect(p.roleBonusThisLap).toBe(ROLE_BONUS_CAP)
    expect(awardRoleBonus(state, p, 1_000_000)).toBe(0)
    expect(p.cash).toBe(300_000)
  })

  it('pays nothing to an eliminated player', () => {
    const { state, players } = makeGame(1, { cash: 0, roles: ['investor'] })
    const p = players[0]!
    p.isEliminated = true
    expect(awardRoleBonus(state, p, 500_000)).toBe(0)
    expect(p.cash).toBe(0)
  })
})

describe('per-lap bonus reset', () => {
  it('resets roleBonusThisLap when the player passes GO', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000, roles: ['investor', null] })
    const p = players[0]!
    state.currentPlayerIndex = 0
    p.roleBonusThisLap = ROLE_BONUS_CAP
    p.position = 39 // any roll wraps past GO
    rollDice(state, p.id, () => 0.4)
    expect(p.roleBonusThisLap).toBe(0)
  })
})

describe('Pejabat jail immunity', () => {
  it('never jails a Pejabat', () => {
    const { state, players } = makeGame(2, { roles: ['pejabat', null] })
    const p = players[0]!
    sendToJail(state, p)
    expect(p.inJail).toBe(false)
    expect(p.jailTurnsLeft).toBe(0)
  })

  it('still jails everyone else', () => {
    const { state, players } = makeGame(2, { roles: ['pejabat', 'sales'] })
    const other = players[1]!
    sendToJail(state, other)
    expect(other.inJail).toBe(true)
  })
})
