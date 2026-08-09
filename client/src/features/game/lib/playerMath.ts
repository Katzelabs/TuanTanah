// Client-side mirrors of two engine player-math helpers: `salaryFor`
// (server/src/engine/roles.ts) and `playerWealth` (server/src/engine/
// elimination.ts). Used by the special-tile info panels to preview what GO pays
// you and what a tax tile would charge you right now. The server stays
// authoritative — this is display-only.
import {
  INFLUENCER_SALARY_CAP,
  INFLUENCER_SALARY_STEP,
  ROLES,
  type GameState,
  type Player,
  type RupiahAmount,
} from '@tuan-tanah/shared'
import { tileValue } from './tileValue.js'

/**
 * GO salary for `player` this round: their role's base salary, except the
 * Influencer's, which grows every round up to a hard cap. Mirrors the engine's
 * `salaryFor`. Returns 0 while the player has no role (lobby).
 */
export function salaryFor(state: GameState, player: Player): RupiahAmount {
  if (!player.role) return 0
  const base = ROLES[player.role].salary
  if (player.role === 'influencer') {
    const grown = base + INFLUENCER_SALARY_STEP * Math.max(0, state.round - 1)
    return Math.min(grown, INFLUENCER_SALARY_CAP)
  }
  return base
}

/**
 * Tax rate multiplier for `player` — an Ojol Driver pays half. Mirrors the
 * engine's `taxMultiplier`.
 */
export function taxMultiplier(player: Player): number {
  return player.role === 'ojol_driver' ? 0.5 : 1
}

/**
 * Total wealth of `player`: cash on hand plus the market value of every tile
 * they own. Mirrors the engine's `playerWealth` (which is also the base of the
 * luxury-tax tile and the wealth win condition).
 */
export function playerWealth(state: GameState, player: Player): RupiahAmount {
  let wealth = player.cash
  for (const tile of state.tiles) {
    if (tile.ownerId !== player.id) continue
    wealth += tileValue(tile, state.tiles)
  }
  return Math.round(wealth)
}
