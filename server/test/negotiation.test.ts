import { SALES_TRANSACTION_BONUS_RATE } from '@tuan-tanah/shared'
import type { NegotiationDeal } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { applyDeal, proposeDeal, respondToDeal, validateDeal } from '../src/engine/negotiation.js'
import { addDebt, makeGame, own } from './helpers.js'

function deal(partial: Partial<NegotiationDeal> & Pick<NegotiationDeal, 'type'>): NegotiationDeal {
  return {
    id: 'placeholder',
    fromPlayerId: 'placeholder',
    toPlayerId: 'placeholder',
    status: 'pending',
    ...partial,
  }
}

describe('validateDeal — property_swap', () => {
  it('accepts a swap where each side owns its tile', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const d = deal({
      type: 'property_swap',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      requestTileId: 2,
    })
    expect(validateDeal(state, d)).toBeNull()
  })

  it('rejects when the proposer no longer owns the offered tile', () => {
    const { state, players } = makeGame(2)
    own(state, 2, players[1]!.id)
    const d = deal({
      type: 'property_swap',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      requestTileId: 2,
    })
    expect(validateDeal(state, d)).not.toBeNull()
  })

  it('rejects a top-up the payer cannot afford', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const d = deal({
      type: 'property_swap',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      requestTileId: 2,
      cashAmount: 5_000_000,
      cashFrom: 'proposer',
    })
    expect(validateDeal(state, d)?.code).toMatch(/afford/i)
  })

  it('rejects an unknown deal type from a stale client', () => {
    const { state, players } = makeGame(2)
    const d = deal({
      type: 'cash_gift' as NegotiationDeal['type'],
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      cashAmount: 1_000_000,
    })
    expect(validateDeal(state, d)?.code).toBe('negotiation.unknownDealType')
  })
})

describe('sell_property', () => {
  it('validates a sale of the proposer’s own tile the buyer can afford', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    own(state, 1, players[0]!.id)
    const d = deal({
      type: 'sell_property',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      cashAmount: 5_000_000,
    })
    expect(validateDeal(state, d)).toBeNull()
  })

  it('rejects when the buyer cannot afford the price', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    own(state, 1, players[0]!.id)
    const d = deal({
      type: 'sell_property',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      cashAmount: 5_000_000,
    })
    expect(validateDeal(state, d)).not.toBeNull()
  })

  it('transfers the tile to the buyer and pays the seller', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [seller, buyer] = players
    own(state, 1, seller!.id)
    const sellerCash = seller!.cash
    const buyerCash = buyer!.cash
    applyDeal(
      state,
      deal({
        type: 'sell_property',
        fromPlayerId: seller!.id,
        toPlayerId: buyer!.id,
        offerTileId: 1,
        cashAmount: 4_000_000,
      }),
    )
    expect(state.tiles[1]!.ownerId).toBe(buyer!.id)
    expect(seller!.cash).toBe(sellerCash + 4_000_000)
    expect(buyer!.cash).toBe(buyerCash - 4_000_000)
  })

  it('lets a broke debtor settle their debt by selling to another player', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const [debtor, buyer] = players
    state.currentPlayerIndex = 0
    own(state, 1, debtor!.id) // debtor's only asset
    buyer!.cash = 10_000_000
    addDebt(state, { debtorId: debtor!.id, amount: 3_000_000, creditorId: null, type: 'tax' })
    proposeDeal(
      state,
      debtor!.id,
      deal({
        type: 'sell_property',
        toPlayerId: buyer!.id,
        offerTileId: 1,
        cashAmount: 5_000_000,
      }),
    )
    const dealId = state.pendingDeals[0]!.id
    respondToDeal(state, buyer!.id, dealId, true)
    // Sale raised 5jt; the 3jt debt auto-settles, leaving the debtor solvent.
    expect(state.pendingDebts).toHaveLength(0)
    expect(state.tiles[1]!.ownerId).toBe(buyer!.id)
    expect(debtor!.cash).toBe(2_000_000) // 5jt from sale − 3jt debt paid
    expect(debtor!.isEliminated).toBe(false)
  })
})

describe('proposeDeal / respondToDeal', () => {
  it('queues a validated deal stamped with the trusted proposer', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const stored = proposeDeal(
      state,
      players[0]!.id,
      deal({
        type: 'property_swap',
        fromPlayerId: 'spoofed',
        toPlayerId: players[1]!.id,
        offerTileId: 1,
        requestTileId: 2,
      }),
    )
    expect(stored.fromPlayerId).toBe(players[0]!.id)
    expect(stored.status).toBe('pending')
    expect(state.pendingDeals).toHaveLength(1)
  })

  it('applies the swap on accept and clears the pending deal', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const stored = proposeDeal(
      state,
      players[0]!.id,
      deal({
        type: 'property_swap',
        fromPlayerId: players[0]!.id,
        toPlayerId: players[1]!.id,
        offerTileId: 1,
        requestTileId: 2,
      }),
    )
    respondToDeal(state, players[1]!.id, stored.id, true)
    expect(state.tiles[1]!.ownerId).toBe(players[1]!.id)
    expect(state.tiles[2]!.ownerId).toBe(players[0]!.id)
    expect(state.pendingDeals).toHaveLength(0)
  })

  it('drops the deal on reject without applying it', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const stored = proposeDeal(
      state,
      players[0]!.id,
      deal({
        type: 'property_swap',
        fromPlayerId: players[0]!.id,
        toPlayerId: players[1]!.id,
        offerTileId: 1,
        requestTileId: 2,
      }),
    )
    respondToDeal(state, players[1]!.id, stored.id, false)
    expect(state.tiles[1]!.ownerId).toBe(players[0]!.id) // unchanged
    expect(state.pendingDeals).toHaveLength(0)
  })
})

describe('applyDeal', () => {
  it('cash_for_property transfers cash and the tile', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [buyer, seller] = [players[0]!, players[1]!]
    own(state, 2, seller.id)
    applyDeal(
      state,
      deal({
        type: 'cash_for_property',
        fromPlayerId: buyer.id,
        toPlayerId: seller.id,
        requestTileId: 2,
        cashAmount: 3_000_000,
      }),
    )
    expect(buyer.cash).toBe(7_000_000)
    expect(seller.cash).toBe(13_000_000)
    expect(state.tiles[2]!.ownerId).toBe(buyer.id)
  })

  it('property_swap moves cash per cashFrom and swaps ownership', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [a, b] = [players[0]!, players[1]!]
    own(state, 1, a.id)
    own(state, 2, b.id)
    applyDeal(
      state,
      deal({
        type: 'property_swap',
        fromPlayerId: a.id,
        toPlayerId: b.id,
        offerTileId: 1,
        requestTileId: 2,
        cashAmount: 3_000_000,
        cashFrom: 'proposer',
      }),
    )
    expect(a.cash).toBe(7_000_000)
    expect(b.cash).toBe(13_000_000)
    expect(state.tiles[1]!.ownerId).toBe(b.id)
    expect(state.tiles[2]!.ownerId).toBe(a.id)
  })

  it("pays a bystander Sales a commission on other players' tile deals", () => {
    const { state, players } = makeGame(3, { cash: 10_000_000, roles: [null, null, 'sales'] })
    const [buyer, seller, salesPlayer] = [players[0]!, players[1]!, players[2]!]
    salesPlayer.cash = 0
    own(state, 2, seller.id)
    const bankBefore = state.bank
    applyDeal(
      state,
      deal({
        type: 'cash_for_property',
        fromPlayerId: buyer.id,
        toPlayerId: seller.id,
        requestTileId: 2,
        cashAmount: 2_000_000,
      }),
    )
    const bonus = Math.round(2_000_000 * SALES_TRANSACTION_BONUS_RATE)
    expect(salesPlayer.cash).toBe(bonus)
    expect(state.bank).toBe(bankBefore - bonus)
  })

  it('pays no commission when Sales is a participant in the deal', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000, roles: ['sales'] })
    const [salesPlayer, seller] = [players[0]!, players[1]!]
    own(state, 2, seller.id)
    applyDeal(
      state,
      deal({
        type: 'cash_for_property',
        fromPlayerId: salesPlayer.id,
        toPlayerId: seller.id,
        requestTileId: 2,
        cashAmount: 4_000_000,
      }),
    )
    // Paid 4jt for the tile, no bonus back — participants never earn the cut.
    expect(salesPlayer.cash).toBe(10_000_000 - 4_000_000)
    expect(salesPlayer.roleBonusThisLap).toBe(0)
  })
})
