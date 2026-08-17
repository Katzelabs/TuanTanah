// Sentry wiring. Deliberately separate from `observability/report.ts`: this file
// is configuration and I/O (it reads env and opens a transport), while report.ts
// stays the single place that decides WHAT is worth reporting. Nothing else in the
// codebase imports Sentry.
//
// A blank SENTRY_DSN disables it, the same opt-in shape DATABASE_URL uses — and
// `captureException` is a documented no-op on an uninitialised SDK, so no other
// module has to branch on whether it is on.
import * as Sentry from '@sentry/node'
import { env } from './env.js'

export function initSentry(): void {
  if (!env.sentryDsn) return

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,

    // Error tracking only. Performance tracing on a turn-based game would spend
    // the quota on spans nobody reads; the failures that matter here are thrown,
    // not slow.
    tracesSampleRate: 0,

    // The default init loads ~40 integrations — OpenTelemetry instrumentation for
    // Postgres, Redis, Fastify, Kafka, Prisma, half a dozen LLM vendors. They
    // monkey-patch modules this app runs on its hot path, and with tracing off
    // they produce nothing. So take none of them and name what we want instead.
    //
    // Notably absent, on purpose: onUncaughtException / onUnhandledRejection.
    // Sentry's versions would double-report what bootstrap/index.ts already
    // catches, and its uncaught handler decides on its own whether to exit —
    // a decision this app makes deliberately, after flushing.
    defaultIntegrations: false,
    integrations: [
      // Unwraps `cause` chains, so a rethrow doesn't hide the original.
      Sentry.linkedErrorsIntegration(),
      // Source lines around each stack frame — the difference between a file:line
      // and actually seeing the bug.
      Sentry.contextLinesIntegration(),
      // Runtime, OS, and installed versions: the first thing you want when it
      // reproduces on the VPS and not locally.
      Sentry.nodeContextIntegration(),
      Sentry.modulesIntegration(),
      // Collapses identical events from one incident.
      Sentry.dedupeIntegration(),
      // Keeps `sdk.name`-style internals honest; cheap and assumed by the SDK.
      Sentry.functionToStringIntegration(),
    ],
  })
}

/**
 * Drain the queue before the process ends. The transport is async, so a bare
 * `process.exit()` drops whatever is still in flight — which is exactly the fatal
 * event you most wanted to see. Never rejects: shutdown must not hang on the
 * reporter, and a lost report is better than a stuck container.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!env.sentryDsn) return
  try {
    await Sentry.flush(timeoutMs)
  } catch {
    // Deliberately empty — see above.
  }
}
