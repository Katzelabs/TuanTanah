// Which build this browser is running.
//
// `APP_VERSION` comes from `shared/` (imported as source, no build step). The
// SHA cannot: Vite bakes `import.meta.env` at build time while the server reads
// `process.env` at boot, so each tier resolves its own and they meet again in
// `versionLabel`, which both call to produce the identical string.
import { APP_VERSION, DEV_BUILD_SHA, versionLabel } from '@tuan-tanah/shared'

/**
 * Short git SHA baked into the bundle by `client/Dockerfile`, or `dev` when
 * built from source. Vite substitutes this at build time — it is NOT readable
 * from the runtime environment, which is why it arrives as a build arg through
 * compose rather than an `environment:` entry.
 */
export const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || DEV_BUILD_SHA

/** e.g. `v0.2.0 · 1a2b3c4` — what a player quotes back in a bug report. */
export const VERSION_LABEL = versionLabel(BUILD_SHA)

export { APP_VERSION }
