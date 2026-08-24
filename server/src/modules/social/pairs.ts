// Pure helpers for reading a friendship row from one side of it. Kept free of
// I/O so the interesting decisions — which of the two columns is "the other
// player", which way a pending request points, whether a row should be visible
// at all — are unit-testable without a database.
import type { FriendshipStatus, UserId } from '@tuan-tanah/shared'

/**
 * Friend codes are read off a screenshot or a chat message and retyped, so
 * separators and case are noise. Normalizing here means the lookup, the
 * uniqueness check and the error message all agree on one form.
 *
 * The length range is deliberately wider than the 8 characters subtask A
 * generates: this is an input sanity check, not a mirror of A's generator, and
 * hard-coding 8 would silently reject every existing code if that ever changes.
 */
const FRIEND_CODE_PATTERN = /^[A-Z0-9]{4,16}$/

export function normalizeFriendCode(raw: string): string | null {
  const cleaned = (raw ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return FRIEND_CODE_PATTERN.test(cleaned) ? cleaned : null
}

/** The stored shape of a friendship, from `friendships` (see 0002_auth). */
export interface FriendshipRow {
  requester_id: UserId
  addressee_id: UserId
  status: string
}

/** The pair, ordered so A→B and B→A produce the same key. Mirrors 0004's index. */
export function canonicalPair(a: UserId, b: UserId): [UserId, UserId] {
  return a < b ? [a, b] : [b, a]
}

export function otherUserId(row: FriendshipRow, viewerId: UserId): UserId {
  return row.requester_id === viewerId ? row.addressee_id : row.requester_id
}

/** Who acted: `outgoing` when the viewer is the row's requester (or blocker). */
export function directionFor(row: FriendshipRow, viewerId: UserId): 'incoming' | 'outgoing' {
  return row.requester_id === viewerId ? 'outgoing' : 'incoming'
}

const STATUSES: readonly FriendshipStatus[] = ['pending', 'accepted', 'blocked']

/** Narrow the free-text `status` column, or null if the row is unreadable. */
export function asFriendshipStatus(raw: string): FriendshipStatus | null {
  return (STATUSES as readonly string[]).includes(raw) ? (raw as FriendshipStatus) : null
}

/**
 * Whether a row belongs in `viewerId`'s friends list.
 *
 * A block is one-sided information: the blocker needs to see it to undo it, and
 * the blocked player must not learn it happened — from their side the other
 * account simply stops being reachable, which is indistinguishable from never
 * having been added.
 */
export function isVisibleTo(row: FriendshipRow, viewerId: UserId): boolean {
  const status = asFriendshipStatus(row.status)
  if (!status) return false
  if (status === 'blocked') return row.requester_id === viewerId
  return row.requester_id === viewerId || row.addressee_id === viewerId
}
