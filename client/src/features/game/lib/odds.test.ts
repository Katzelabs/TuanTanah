import { JUDOL_JACKPOT_RATE, JUDOL_WIN_RATE, KORUPSI_SUCCESS_RATE } from '@tuan-tanah/shared'
import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import id from '@/i18n/locales/id.json'
import { JUDOL_ODDS, KORUPSI_ODDS } from './odds.js'

describe('JUDOL_ODDS', () => {
  it('multiplies the jackpot sub-roll by the win rate', () => {
    // The engine rolls the jackpot only after a win lands, so quoting the raw
    // JUDOL_JACKPOT_RATE would overstate a player's real jackpot chance.
    expect(JUDOL_ODDS.jackpotPercent).toBe(Math.round(JUDOL_WIN_RATE * JUDOL_JACKPOT_RATE * 100))
    expect(JUDOL_ODDS.jackpotPercent).toBeLessThan(Math.round(JUDOL_JACKPOT_RATE * 100))
  })

  it('splits the win rate into plain-win and jackpot slices', () => {
    expect(JUDOL_ODDS.winPercent + JUDOL_ODDS.jackpotPercent).toBe(Math.round(JUDOL_WIN_RATE * 100))
  })
})

describe('KORUPSI_ODDS', () => {
  it('treats success and bust as complements', () => {
    expect(KORUPSI_ODDS.successPercent).toBe(Math.round(KORUPSI_SUCCESS_RATE * 100))
    expect(KORUPSI_ODDS.successPercent + KORUPSI_ODDS.bustPercent).toBe(100)
  })
})

// Guards against someone re-hardcoding a rate into the copy: every number these
// strings quote must arrive by interpolation, so a balance change to the shared
// constants can never leave the UI lying about the odds.
describe('gambling copy is interpolated, not hardcoded', () => {
  const KEYS = [
    'pinjol.terms',
    'judol.terms',
    'meta.descriptions.judol',
    'meta.descriptions.korupsi',
    'meta.descriptions.sabotage',
  ]

  it.each(['en', 'id'] as const)('quotes no literal percentage in %s', (lng) => {
    const resources = lng === 'en' ? en : id
    const i18n = createInstance()
    void i18n.init({
      lng,
      resources: { [lng]: { translation: resources } },
      interpolation: { escapeValue: false },
    })
    for (const key of KEYS) {
      // Read the raw template (no interpolation values supplied).
      const template = i18n.getResource(lng, 'translation', key) as string
      expect(template, key).toBeTypeOf('string')
      expect(template, `${key} hardcodes a percentage`).not.toMatch(/\d+\s*%/)
      expect(template, `${key} hardcodes a rupiah amount`).not.toMatch(/Rp\s*[\d.]/)
      expect(template, `${key} hardcodes a payout multiplier`).not.toMatch(/x\d/)
    }
  })
})
