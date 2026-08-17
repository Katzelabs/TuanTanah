// The single place unexpected errors are reported from.
//
// Everything that reaches `reportError` is a BUG. Expected, player-facing
// rejections — "not your turn", "not enough cash" — are `EngineError` and are
// deliberately routed elsewhere (see the split in `realtime/common.ts`). Keeping
// the two apart is what makes this stream worth reading at all: mixed together, a
// real fault is one line in a river of rule violations, which is why it was worth
// doing before wiring an error tracker rather than after.
//
// Today it writes one structured line to stderr. Docker captures and rotates that
// (10MB x 3, set globally on the box), so this is durable enough to grep but not
// to alert on — nobody is watching. That is the point of the seam: when Sentry is
// configured, exactly one function changes, and the hard part (deciding what
// deserves to be reported) is already settled.
//
// It must never throw. Every caller is a catch block or a live game path.

/** Context tags attached to a report. Primitives only, so this can never throw. */
export type ErrorContext = Record<string, string | number | undefined>

export function reportError(err: unknown, context: ErrorContext = {}): void {
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
      ...tags,
    }),
  )

  // SENTRY SEAM — `Sentry.captureException(e, { tags })` belongs here, behind a
  // blank-DSN no-op check, and nowhere else in the codebase.
}
