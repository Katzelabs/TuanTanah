// The changelog's enforcement (ClickUp 86eyr3xvf).
//
// The stated risk on that ticket is that changelogs die quietly: the page ships,
// gets two entries, and is then six months stale — which reads as an abandoned
// product. The mitigation is that a release is not done until its entry exists,
// and the only way that survives contact with a deadline is if CI says so.
//
// So: the newest entry must match the version being shipped. Bumping APP_VERSION
// without writing the entry fails here, in the same run that would have let it
// through.
import { describe, expect, it } from 'vitest'
import { APP_VERSION, CHANGELOG, CHANGE_KINDS } from '@tuan-tanah/shared'

const SEMVER = /^\d+\.\d+\.\d+$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** [major, minor, patch] for comparison — string compare puts 0.10.0 below 0.9.0. */
function parts(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number)
  return [major, minor, patch]
}

function isDescending(a: string, b: string): boolean {
  const [aMaj, aMin, aPat] = parts(a)
  const [bMaj, bMin, bPat] = parts(b)
  if (aMaj !== bMaj) return aMaj > bMaj
  if (aMin !== bMin) return aMin > bMin
  return aPat > bPat
}

describe('CHANGELOG', () => {
  it('has at least one release', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
  })

  it('leads with the version currently shipping', () => {
    // The acceptance criterion "current app version matches the newest changelog
    // entry", and the thing that makes a forgotten entry a build failure.
    expect(CHANGELOG[0]?.version).toBe(APP_VERSION)
  })

  it('is ordered newest first', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const newer = CHANGELOG[i - 1]!.version
      const older = CHANGELOG[i]!.version
      expect(isDescending(newer, older), `${newer} should sort above ${older}`).toBe(true)
    }
  })

  it('has no duplicate versions', () => {
    const versions = CHANGELOG.map((r) => r.version)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it.each(CHANGELOG.map((r) => [r.version, r] as const))(
    '%s is well-formed and bilingual',
    (_version, release) => {
      expect(release.version).toMatch(SEMVER)
      expect(release.date).toMatch(ISO_DATE)
      expect(Number.isNaN(Date.parse(release.date))).toBe(false)
      expect(release.changes.length).toBeGreaterThan(0)

      for (const change of release.changes) {
        expect(CHANGE_KINDS).toContain(change.kind)
        // A missing Indonesian line is the failure this whole shape exists to
        // prevent — the game is Indonesian-themed and defaults to Indonesian, so
        // an English-only entry is unreadable for the default player.
        expect(change.en.trim().length, `en missing for: ${change.id}`).toBeGreaterThan(0)
        expect(change.id.trim().length, `id missing for: ${change.en}`).toBeGreaterThan(0)
      }
    },
  )
})
