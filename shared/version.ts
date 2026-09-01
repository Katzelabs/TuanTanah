// The app's release version — one number, read by both tiers.
//
// It lives in `shared/` because `shared/` has no build step: server and client
// import its `.ts` source directly, so a plain exported constant is readable
// everywhere with no bundler `define`, no runtime `fs` read, and no env var that
// can be set on one tier and forgotten on the other.
//
// The root `package.json` carries the same number, because that is the file a
// human (or `npm version`) bumps. `server/test/version.test.ts` fails the build
// if the two ever disagree. The per-workspace manifests are private and never
// published, so their `version` fields mean nothing and are left alone.
//
// Bumping this is part of cutting a release, alongside its changelog entry — see
// the release checklist in README.md.
export const APP_VERSION = '0.2.0'

/**
 * Placeholder used by both tiers when no build SHA was injected — i.e. running
 * from source rather than from a built image.
 *
 * A literal rather than an empty string on purpose: "dev" is a true and useful
 * answer to "which build is this?", where a blank would render as a version
 * label with a dangling separator and read like the value failed to load.
 */
export const DEV_BUILD_SHA = 'dev'

/**
 * Human-readable build identity, e.g. `v0.2.0` or `v0.2.0 · 1a2b3c4`.
 *
 * Shared so the string a player reads on screen is byte-identical to the one the
 * server reports at `/api/health` — when a bug report quotes a version, there is
 * no question of which of the two formats produced it.
 */
export function versionLabel(buildSha: string): string {
  return buildSha === DEV_BUILD_SHA ? `v${APP_VERSION}` : `v${APP_VERSION} · ${buildSha}`
}
