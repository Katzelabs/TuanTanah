// Display-only odds derived from the shared gambling constants, so the numbers
// quoted in the Judol modal and the meta-action tooltips can't drift from what
// the engine actually rolls (server/src/engine/actions.ts).
import { JUDOL_JACKPOT_RATE, JUDOL_WIN_RATE, KORUPSI_SUCCESS_RATE } from '@tuan-tanah/shared'

/**
 * Judol odds as a player experiences them. The engine rolls the jackpot as a
 * sub-roll *within* a win, so the odds of each visible outcome are the products
 * of the two rates — not the raw constants.
 */
export const JUDOL_ODDS = {
  /** Chance of a plain (non-jackpot) win, in whole percent. */
  winPercent: Math.round(JUDOL_WIN_RATE * (1 - JUDOL_JACKPOT_RATE) * 100),
  /** Chance of the jackpot, in whole percent. */
  jackpotPercent: Math.round(JUDOL_WIN_RATE * JUDOL_JACKPOT_RATE * 100),
}

/** Korupsi: a flat success roll, so success and bust are complements. */
export const KORUPSI_ODDS = {
  successPercent: Math.round(KORUPSI_SUCCESS_RATE * 100),
  bustPercent: Math.round((1 - KORUPSI_SUCCESS_RATE) * 100),
}
