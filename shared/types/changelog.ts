// The player-facing changelog (ClickUp 86eyr3xvf).
//
// Not to be confused with `docs/changelog/`, which is engineering notes for us —
// Kysely tables, constant names, ClickUp links. This is what players read, and
// the two have different audiences and different language.

/**
 * The three buckets a release note falls into. Deliberately not "breaking",
 * "deprecated", "security" and the rest of a keep-a-changelog taxonomy: those
 * are categories for people who integrate against an API, and nobody playing a
 * board game has ever wanted them.
 */
export const CHANGE_KINDS = ['new', 'improved', 'fixed'] as const
export type ChangeKind = (typeof CHANGE_KINDS)[number]

/**
 * One line of a release, in both languages.
 *
 * The two live side by side rather than in the `locales/*.json` overlay the rest
 * of the UI uses. A changelog entry is written once, in the same PR as the change
 * it describes, and never touched again — so the failure worth designing against
 * is not "hard to translate later", it is "the Indonesian half quietly never gets
 * written". Sitting in the same object makes a missing translation visible at
 * authoring time, and a test makes it fatal.
 */
export interface ChangelogChange {
  kind: ChangeKind
  en: string
  id: string
}

export interface ChangelogRelease {
  /** Semver triple, matching `APP_VERSION` for the newest entry. */
  version: string
  /** Release date as `YYYY-MM-DD`, rendered in the viewer's locale. */
  date: string
  changes: readonly ChangelogChange[]
}
