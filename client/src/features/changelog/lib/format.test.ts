import { describe, expect, it } from 'vitest'
import type { ChangelogChange } from '@tuan-tanah/shared'
import { changeText, formatReleaseDate } from './format.js'

const CHANGE: ChangelogChange = { kind: 'new', en: 'English line', id: 'Baris Indonesia' }

describe('changeText', () => {
  it('picks English for an English viewer', () => {
    expect(changeText(CHANGE, 'en')).toBe('English line')
    expect(changeText(CHANGE, 'en-GB')).toBe('English line')
  })

  it('falls back to Indonesian, not English, for anything else', () => {
    // Matches i18n/index.ts: the game defaults to Indonesian, so an unknown tag
    // should land on the majority language.
    expect(changeText(CHANGE, 'id')).toBe('Baris Indonesia')
    expect(changeText(CHANGE, 'fr')).toBe('Baris Indonesia')
  })
})

describe('formatReleaseDate', () => {
  it('keeps the calendar day the entry was authored with', () => {
    // The regression this guards: a bare 'YYYY-MM-DD' parses as UTC midnight and
    // renders as the previous day for anyone west of Greenwich, so a release
    // would appear to have shipped a day early.
    const formatted = formatReleaseDate('2026-09-01', 'en-GB')
    expect(formatted).toContain('2026')
    expect(formatted).toContain('1')
    expect(formatted).not.toContain('31')
  })

  it('falls back to the raw string rather than showing "Invalid Date"', () => {
    expect(formatReleaseDate('not-a-date', 'en')).toBe('not-a-date')
  })
})
