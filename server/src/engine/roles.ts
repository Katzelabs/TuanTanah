// Role passive resolvers (Balance v3). Each role taxes a different stream of
// the economy; bonus money is bank-paid and clamped by `awardRoleBonus` to a
// per-lap cap that resets when the recipient passes GO. Centralizes the
// per-role rules so engine call sites stay generic.
import {
  INFLUENCER_SALARY_CAP,
  INFLUENCER_SALARY_STEP,
  INVESTOR_RENT_CUT_RATE,
  KONTRAKTOR_BUILD_CUT_RATE,
  KONTRAKTOR_BUILD_DISCOUNT_MULTIPLIER,
  OJOL_TRANSPORT_BONUS_RATE,
  PENGACARA_LAW_CUT_RATE,
  PENGUSAHA_INCOME_BONUS_RATE,
  RENTENIR_INTEREST_CUT_RATE,
  ROLE_BONUS_CAP,
  ROLES,
  rpP,
  SALES_BONUS_CAP,
  SALES_BUY_DISCOUNT_MULTIPLIER,
  SALES_TRANSACTION_BONUS_RATE,
} from '@tuan-tanah/shared'
import type { GameState, Player, RupiahAmount, TileId } from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { logKey } from './util.js'

/** GO salary for a player. Influencer's grows each round up to a hard cap. */
export function salaryFor(state: GameState, player: Player): RupiahAmount {
  if (!player.role) return 0
  const base = ROLES[player.role].salary
  if (player.role === 'influencer') {
    const grown = base + INFLUENCER_SALARY_STEP * Math.max(0, state.round - 1)
    return Math.min(grown, INFLUENCER_SALARY_CAP)
  }
  return base
}

/** Property purchase discount multiplier (Sales buys 20% cheaper). */
export function buyPriceMultiplier(player: Player): number {
  return player.role === 'sales' ? SALES_BUY_DISCOUNT_MULTIPLIER : 1
}

/** Build/upgrade cost discount multiplier (Kontraktor builds 50% cheaper). */
export function buildCostMultiplier(player: Player): number {
  return player.role === 'kontraktor' ? KONTRAKTOR_BUILD_DISCOUNT_MULTIPLIER : 1
}

/** Investor's skim on a rent payment between two other players. */
export function investorCut(amount: RupiahAmount): RupiahAmount {
  return Math.round(amount * INVESTOR_RENT_CUT_RATE)
}

/**
 * Tax multiplier for a player (tax tiles + the BBM card). Ojol Driver pays half;
 * everyone else pays in full.
 */
export function taxMultiplier(player: Player): number {
  return player.role === 'ojol_driver' ? 0.5 : 1
}

/**
 * Pay a role-passive bonus from the bank, clamped to the recipient's remaining
 * per-lap allowance (`roleBonusThisLap`, reset when they pass GO). Returns the
 * amount actually paid so call sites can log it (0 = cap reached, log nothing).
 */
export function awardRoleBonus(
  state: GameState,
  recipient: Player,
  amount: RupiahAmount,
  cap: RupiahAmount = ROLE_BONUS_CAP,
): RupiahAmount {
  if (recipient.isEliminated) return 0
  const paid = Math.min(Math.round(amount), Math.max(0, cap - recipient.roleBonusThisLap))
  if (paid <= 0) return 0
  recipient.roleBonusThisLap += paid
  recipient.cash += paid
  state.bank -= paid
  return paid
}

/**
 * Role bonuses triggered by a rent payment: the Investor skims rent paid
 * between two other players, and the receiving owner may hold a rent-boosting
 * role (Pengusaha on any rent, Ojol Driver on transport tiles).
 */
export function applyRentRoleBonuses(
  state: GameState,
  payerId: string,
  ownerId: string,
  amount: RupiahAmount,
  tileId?: TileId,
): void {
  for (const inv of state.players) {
    if (inv.role !== 'investor' || inv.isEliminated) continue
    if (inv.id === payerId || inv.id === ownerId) continue
    const paid = awardRoleBonus(state, inv, investorCut(amount))
    if (paid > 0) logKey(state, 'roles.investorCut', { name: inv.name, amount: rpP(paid) }, inv.id)
  }
  const owner = state.players.find((p) => p.id === ownerId)
  if (!owner) return
  if (owner.role === 'pengusaha') {
    const paid = awardRoleBonus(state, owner, amount * PENGUSAHA_INCOME_BONUS_RATE)
    if (paid > 0) {
      logKey(state, 'roles.pengusahaRentBonus', { name: owner.name, amount: rpP(paid) }, owner.id)
    }
  } else if (
    owner.role === 'ojol_driver' &&
    tileId !== undefined &&
    getTileDef(tileId).type === 'transport'
  ) {
    const paid = awardRoleBonus(state, owner, amount * OJOL_TRANSPORT_BONUS_RATE)
    if (paid > 0) {
      logKey(state, 'roles.ojolTransportBonus', { name: owner.name, amount: rpP(paid) }, owner.id)
    }
  }
}

/** Pengusaha's +50% bonus on their own passive income (capped per lap). */
export function applyPassiveIncomeRoleBonus(
  state: GameState,
  player: Player,
  income: RupiahAmount,
): void {
  if (player.role !== 'pengusaha' || income <= 0) return
  const paid = awardRoleBonus(state, player, income * PENGUSAHA_INCOME_BONUS_RATE)
  if (paid > 0) {
    logKey(
      state,
      'roles.pengusahaPassiveBonus',
      { name: player.name, amount: rpP(paid) },
      player.id,
    )
  }
}

/** Kontraktor skims a cut of what OTHER players spend on builds/upgrades. */
export function applyKontraktorBuildCut(
  state: GameState,
  builderId: string,
  cost: RupiahAmount,
): void {
  for (const k of state.players) {
    if (k.role !== 'kontraktor' || k.isEliminated || k.id === builderId) continue
    const paid = awardRoleBonus(state, k, cost * KONTRAKTOR_BUILD_CUT_RATE)
    if (paid > 0) logKey(state, 'roles.kontraktorCut', { name: k.name, amount: rpP(paid) }, k.id)
  }
}

/** Pengacara skims a cut of law-office fees OTHER players pay to the bank. */
export function applyPengacaraLawCut(
  state: GameState,
  payerId: string,
  amount: RupiahAmount,
): void {
  for (const lawyer of state.players) {
    if (lawyer.role !== 'pengacara' || lawyer.isEliminated || lawyer.id === payerId) continue
    const paid = awardRoleBonus(state, lawyer, amount * PENGACARA_LAW_CUT_RATE)
    if (paid > 0) {
      logKey(state, 'roles.pengacaraCut', { name: lawyer.name, amount: rpP(paid) }, lawyer.id)
    }
  }
}

/**
 * Rentenir skims a cut of pinjol interest OTHER players pay. Skipped when the
 * Rentenir is the loan's direct lender — they already collect 100% of that
 * interest, no double bonus.
 */
export function applyRentenirInterestCut(
  state: GameState,
  borrowerId: string,
  lenderId: string | null,
  interest: RupiahAmount,
): void {
  for (const shark of state.players) {
    if (shark.role !== 'rentenir' || shark.isEliminated) continue
    if (shark.id === borrowerId || shark.id === lenderId) continue
    const paid = awardRoleBonus(state, shark, interest * RENTENIR_INTEREST_CUT_RATE)
    if (paid > 0) {
      logKey(state, 'roles.rentenirCut', { name: shark.name, amount: rpP(paid) }, shark.id)
    }
  }
}

/**
 * Sales earns a commission on tile transactions OTHER players make — bank buys,
 * bank sells, and player-to-player tile deals. `actorIds` are the transaction's
 * participants (never paid). Capped at the lower SALES_BONUS_CAP per lap.
 */
export function applySalesTransactionCut(
  state: GameState,
  actorIds: string[],
  amount: RupiahAmount,
): void {
  if (amount <= 0) return
  for (const seller of state.players) {
    if (seller.role !== 'sales' || seller.isEliminated || actorIds.includes(seller.id)) continue
    const paid = awardRoleBonus(
      state,
      seller,
      amount * SALES_TRANSACTION_BONUS_RATE,
      SALES_BONUS_CAP,
    )
    if (paid > 0)
      logKey(state, 'roles.salesCut', { name: seller.name, amount: rpP(paid) }, seller.id)
  }
}
