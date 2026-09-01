// The in-app feedback / bug report contract (ClickUp 86eyr3xtu).
//
// Shared so the form's `maxLength` and the server's validation are the same
// numbers rather than two copies that drift — a client that lets someone type
// 4001 characters into a field the server rejects wastes the report *and* the
// reporter's goodwill, which is the one thing this feature cannot afford.

export const FEEDBACK_TYPES = ['bug', 'suggestion', 'other'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

/** Long enough for a real sentence, short enough to scan in a list. */
export const FEEDBACK_TITLE_MAX = 120
/** Room for reproduction steps without inviting a pasted logfile. */
export const FEEDBACK_DESCRIPTION_MAX = 4000
/** An email, a Discord handle, or an IG @ — never validated as any one of them. */
export const FEEDBACK_CONTACT_MAX = 200

/**
 * A compact snapshot of the game a report was filed from.
 *
 * Deliberately NOT the whole `GameState`: that is tens of kilobytes, exceeds the
 * server's body limit on a busy board, and carries every other player's cash and
 * holdings — none of which the reporter agreed to send. These five fields are
 * what actually places a bug in the game: which phase, how far in, whose turn,
 * who was reporting, and how many were playing.
 */
export interface FeedbackGameSnapshot {
  phase: string
  round: number
  /** Whose turn it was — pairs with `myPlayerId` to show if it was theirs. */
  currentPlayerId: string | null
  myPlayerId: string | null
  playerCount: number
}

/**
 * Everything collected without the reporter lifting a finger.
 *
 * Note what is NOT here: the account id. A client-sent user id is a claim, not a
 * fact, and attributing a report to whoever the payload names would let anyone
 * file in someone else's name. The server reads it from the session cookie
 * instead — see `modules/feedback/index.ts`.
 */
export interface FeedbackContext {
  appVersion: string
  buildSha: string
  userAgent: string
  /** The reporter's UI language, so a reply can be written in it. */
  language: string
  viewportWidth: number
  viewportHeight: number
  /** Room the report was filed from, or null outside a game. */
  roomId: string | null
  game: FeedbackGameSnapshot | null
}

export interface FeedbackSubmission {
  type: FeedbackType
  title: string
  description: string
  /** Optional — a report we can't reply to is still worth having. */
  contact?: string
  context: FeedbackContext
}

/**
 * Stable failure codes, localized on the client under `feedback.errors.*` — the
 * same split the engine and the account routes use.
 *
 * `network` is client-only: it is what a thrown fetch becomes, so a caller never
 * has to deal with an exception.
 */
export type FeedbackErrorCode = 'invalid' | 'rate_limited' | 'unavailable' | 'network'
