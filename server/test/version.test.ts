// The version scheme's one enforcement point.
//
// `APP_VERSION` and the root package.json both carry the release number, and
// they are bumped by hand. Nothing else notices when only one of them moves, and
// the failure is silent in the worst way: the UI and `/api/health` would report
// a version the repo does not agree with, which is exactly the number a bug
// report is supposed to make trustworthy.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_VERSION, DEV_BUILD_SHA, versionLabel } from '@tuan-tanah/shared'

// server/test/ -> repo root.
const rootManifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
) as { version?: unknown }

describe('APP_VERSION', () => {
  it('matches the root package.json version', () => {
    expect(rootManifest.version).toBe(APP_VERSION)
  })

  it('is a plain semver triple', () => {
    // No pre-release or build metadata: the changelog keys entries off this
    // string, and `0.2.0-rc.1+build.4` is not a heading a player should read.
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('versionLabel', () => {
  it('omits the SHA when running from source', () => {
    expect(versionLabel(DEV_BUILD_SHA)).toBe(`v${APP_VERSION}`)
  })

  it('appends a real build SHA', () => {
    expect(versionLabel('1a2b3c4')).toBe(`v${APP_VERSION} · 1a2b3c4`)
  })
})
