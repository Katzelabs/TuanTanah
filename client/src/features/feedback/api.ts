// The feedback endpoints (ClickUp 86eyr3xtu).
//
// Like `features/account/api.ts`, the server answers with a stable `error` code
// rather than prose so the message renders in the viewer's language. Every
// failure — including a thrown fetch — is mapped to one of those codes, so a
// caller never has to catch.
import type { FeedbackErrorCode, FeedbackSubmission } from '@tuan-tanah/shared'

export type FeedbackResult = { ok: true } | { ok: false; error: FeedbackErrorCode }

const CODES: readonly string[] = ['invalid', 'rate_limited', 'unavailable']

/** Trust only codes we know; anything else (a proxy's HTML 502) is 'unavailable'. */
async function errorFrom(response: Response): Promise<FeedbackErrorCode> {
  // 429 is produced by the rate-limit plugin, not by our handler, so it carries
  // the plugin's own body rather than one of our codes. Map it by status.
  if (response.status === 429) return 'rate_limited'
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string' && CODES.includes(body.error)) {
      return body.error as FeedbackErrorCode
    }
  } catch {
    // Not JSON — fall through.
  }
  return 'unavailable'
}

/**
 * Whether this deployment has anywhere to send reports. A server with no sink
 * configured is a supported state, and the client hides its entry points rather
 * than offering a button that can only fail.
 *
 * Any failure answers `false` for the same reason: an entry point we can't
 * confirm works is worse than one we don't show.
 */
export async function fetchFeedbackEnabled(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/feedback/config', { credentials: 'same-origin', signal })
    if (!res.ok) return false
    const body = (await res.json()) as { enabled?: unknown }
    return body.enabled === true
  } catch {
    return false
  }
}

export async function submitFeedback(submission: FeedbackSubmission): Promise<FeedbackResult> {
  let response: Response
  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      // The session cookie is what attributes the report to an account; the
      // payload deliberately carries no user id for the server to trust.
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submission),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  if (!response.ok) return { ok: false, error: await errorFrom(response) }
  return { ok: true }
}
