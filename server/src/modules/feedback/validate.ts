// Turns an untrusted request body into a `FeedbackSubmission`, or nothing.
//
// Everything here is defensive on purpose: this is the only unauthenticated
// write endpoint in the app, so the body is whatever the internet felt like
// sending. Nothing is coerced silently — a field that isn't the right shape
// makes the whole submission invalid rather than becoming `"undefined"` in a
// report someone has to read.
import {
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_DESCRIPTION_MAX,
  FEEDBACK_TITLE_MAX,
  FEEDBACK_TYPES,
  type FeedbackContext,
  type FeedbackGameSnapshot,
  type FeedbackSubmission,
  type FeedbackType,
} from '@tuan-tanah/shared'

/** Caps on the auto-collected strings. Generous — these are not typed by hand. */
const USER_AGENT_MAX = 512
const LANGUAGE_MAX = 16
const ROOM_ID_MAX = 32
const VERSION_MAX = 40
const PLAYER_ID_MAX = 64
const PHASE_MAX = 32

const TAB = 0x09
const NEWLINE = 0x0a
const SPACE = 0x20
const DELETE = 0x7f

/**
 * Drop control characters, keeping the two that carry meaning in a description
 * someone typed: tab and newline.
 *
 * Stripped rather than rejected — a paste out of a terminal or a chat client
 * picks these up, and refusing a whole bug report over an invisible byte would
 * be perverse. Written as a scan rather than a regex so this file contains no
 * literal control characters of its own.
 */
function stripControl(value: string, multiline: boolean): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    // Handled before the control-character cut below, which would otherwise drop
    // these two on the way past. A single-line field flattens them to spaces
    // rather than deleting them, so "line one\nline two" doesn't come out as
    // "line onetwo".
    if (code === TAB || code === NEWLINE) {
      out += multiline ? ch : ' '
      continue
    }
    if (code < SPACE || code === DELETE) continue
    out += ch
  }
  return out
}

/** Trim, strip control characters, cap. Null when nothing usable is left. */
function clean(value: unknown, max: number, multiline = false): string | null {
  if (typeof value !== 'string') return null
  const stripped = stripControl(value, multiline).trim()
  return stripped.length === 0 ? null : stripped.slice(0, max)
}

function finiteInt(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  // Clamped rather than rejected: a viewport is diagnostic colour, never a
  // reason to lose the report attached to it.
  return Math.min(Math.max(Math.trunc(value), 0), max)
}

function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === 'string' && (FEEDBACK_TYPES as readonly string[]).includes(value)
}

function parseGame(value: unknown): FeedbackGameSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const g = value as Record<string, unknown>
  const phase = clean(g.phase, PHASE_MAX)
  if (!phase) return null
  return {
    phase,
    round: finiteInt(g.round, 100_000),
    currentPlayerId: clean(g.currentPlayerId, PLAYER_ID_MAX),
    myPlayerId: clean(g.myPlayerId, PLAYER_ID_MAX),
    playerCount: finiteInt(g.playerCount, 64),
  }
}

/**
 * Context is best-effort: a missing or malformed field becomes a blank, never a
 * rejection. The reporter didn't type any of it, so failing their report over it
 * would punish them for our own telemetry.
 */
function parseContext(value: unknown): FeedbackContext {
  const c = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  return {
    appVersion: clean(c.appVersion, VERSION_MAX) ?? 'unknown',
    buildSha: clean(c.buildSha, VERSION_MAX) ?? 'unknown',
    userAgent: clean(c.userAgent, USER_AGENT_MAX) ?? '',
    language: clean(c.language, LANGUAGE_MAX) ?? '',
    viewportWidth: finiteInt(c.viewportWidth, 100_000),
    viewportHeight: finiteInt(c.viewportHeight, 100_000),
    roomId: clean(c.roomId, ROOM_ID_MAX),
    game: parseGame(c.game),
  }
}

/**
 * The three fields a human actually typed are the only ones that can invalidate
 * a submission. Returns null when any of them is missing or unusable.
 */
export function parseSubmission(body: unknown): FeedbackSubmission | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>

  if (!isFeedbackType(b.type)) return null
  const title = clean(b.title, FEEDBACK_TITLE_MAX)
  if (!title) return null
  const description = clean(b.description, FEEDBACK_DESCRIPTION_MAX, true)
  if (!description) return null

  const contact = clean(b.contact, FEEDBACK_CONTACT_MAX)

  return {
    type: b.type,
    title,
    description,
    ...(contact ? { contact } : {}),
    context: parseContext(b.context),
  }
}
