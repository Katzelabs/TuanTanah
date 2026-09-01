// Display helpers for the changelog, kept out of the component so they can be
// unit-tested — the same split `features/game/lib/` uses.
import type { ChangelogChange } from '@tuan-tanah/shared'

/**
 * Pick the viewer's half of a bilingual entry.
 *
 * Falls back to Indonesian rather than English, matching `i18n/index.ts`: the
 * game is Indonesian-themed and defaults to Indonesian, so an unrecognised
 * language tag should land on the majority language, not the minority one.
 */
export function changeText(change: ChangelogChange, language: string): string {
  return language.startsWith('en') ? change.en : change.id
}

/**
 * Render a `YYYY-MM-DD` release date in the viewer's locale.
 *
 * The time is appended deliberately. A bare date string is parsed as UTC
 * midnight, which `toLocaleDateString` then renders as the *previous* day for
 * anyone west of Greenwich — so a release would appear to have shipped a day
 * before it did. With a time component it parses as local midnight instead.
 */
export function formatReleaseDate(date: string, language: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  // An unparseable date is content we can still show; the raw string beats
  // "Invalid Date" on a page whose whole job is being readable.
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' })
}
