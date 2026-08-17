// The single place unexpected errors are reported from.
//
// Everything that reaches `reportError` is a BUG. Expected, player-facing
// rejections — "not your turn", "not enough cash" — are `EngineError` and are
// deliberately routed elsewhere (see the split in `realtime/common.ts`). Keeping
// the two apart is what makes this stream worth reading at all: mixed together, a
// real fault is one line in a river of rule violations, which is why it was worth
// doing before wiring an error tracker rather than after.
//
// It writes one structured line to stderr — Docker captures and rotates that
// (10MB x 3, set globally on the box) — and forwards to Sentry when SENTRY_DSN is
// set. The stderr line is not redundant: it is what is left when the DSN is blank
// in dev, when the quota runs out, or when Sentry itself is the thing that broke.
//
// It must never throw. Every caller is a catch block or a live game path.

import * as Sentry from '@sentry/node'

/** Context tags attached to a report. Primitives only, so this can never throw. */
export type ErrorContext = Record<string, string | number | undefined>

export type ReportOptions = {
  /**
   * Did application code catch this and carry on? Default true — a socket handler
   * that rejects one action and keeps serving is handled. Pass `false` only when
   * the fault escaped every handler and the process is going down or was never
   * up: Sentry counts unhandled events against the crash rate, so marking an
   * ordinary caught error unhandled makes the app look like it is falling over.
   */
  handled?: boolean
}

export function reportError(
  err: unknown,
  context: ErrorContext = {},
  { handled = true }: ReportOptions = {},
): void {
  const e = err instanceof Error ? err : new Error(String(err))

  const tags: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) tags[key] = value
  }

  console.error(
    JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      err: e.message,
      stack: e.stack,
      handled,
      ...tags,
    }),
  )

  // No-op until `initSentry()` has run with a DSN, so this needs no guard.
  //
  // `at` is the only tag: tags are indexed for search and grouping, which suits a
  // fixed set of code paths and not room or player ids — those are unbounded, and
  // a tag per game would bloat the index for a filter nobody uses. They go in
  // extra, where they are still right there on the event.
  //
  // Both live under one hint: `captureContext` and `mechanism` are separate fields
  // on it, and the SDK's overloads do not let you pass a bare capture-context
  // object alongside a mechanism.
  const { at, ...ids } = tags
  Sentry.captureException(e, {
    mechanism: { type: 'generic', handled },
    captureContext: {
      tags: at === undefined ? undefined : { at: String(at) },
      extra: ids,
    },
  })
}
