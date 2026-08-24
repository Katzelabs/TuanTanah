// Friends: friend-code lookup, requests, accept/decline, remove and block.
//
// I/O lives here (Postgres via Kysely) — `engine/` stays pure, and nothing in
// this file touches game state. The rules it enforces are the ones the schema
// cannot: who may respond to a request, who may lift a block, and how many
// requests one account can have in flight.
//
// Every rejection is a `FriendsError` carrying a message code from
// `shared/i18n/messages/friends.ts`, so a "no" reaches the player localized in
// exactly the way an `EngineError` does.
import type { FriendSummary, User, UserId } from '@tuan-tanah/shared'
import { sql, type ExpressionBuilder, type SqlBool } from 'kysely'
import { getDb } from '../../persistence/db.js'
import type { Database } from '../../persistence/schema.js'
import {
  asFriendshipStatus,
  directionFor,
  isVisibleTo,
  normalizeFriendCode,
  otherUserId,
  type FriendshipRow,
} from './pairs.js'
import { currentRoomOf, isOnline } from './presence.js'

/**
 * Ceiling on requests one account can have waiting for an answer. The per-socket
 * token bucket in ../../security.ts already stops a flood, but it resets when the
 * socket does — it bounds rate, not the standing pile of requests one account can
 * park in other people's inboxes. This bounds that.
 */
export const MAX_PENDING_OUTGOING = 20

/** A rejected friend action: expected control flow, not a fault. */
export class FriendsError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'FriendsError'
  }
}

function requireDb() {
  const db = getDb()
  // Friendships are durable, so no Postgres means no friends — the same opt-in
  // shape as game-history archival, except this one has to say so out loud
  // rather than no-op, or the UI would show an empty list and look broken.
  if (!db) throw new FriendsError('friends.unavailable')
  return db
}

/** Match a friendship whichever way round the pair was stored. */
function pairFilter(eb: ExpressionBuilder<Database, 'friendships'>, a: UserId, b: UserId) {
  return eb.or([
    eb.and([eb('requester_id', '=', a), eb('addressee_id', '=', b)]),
    eb.and([eb('requester_id', '=', b), eb('addressee_id', '=', a)]),
  ])
}

const USER_COLUMNS = ['id', 'display_name', 'avatar_url', 'friend_code', 'created_at'] as const

interface UserRow {
  id: string
  display_name: string
  avatar_url: string | null
  friend_code: string
  created_at: Date
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    friendCode: row.friend_code,
    // `timestamptz` comes back as a Date from pg, but a driver/pool setting can
    // hand back the raw string instead — accept both rather than crash on it.
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

function isPgErrorCode(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code
}

// ---- Reads ----

/**
 * The viewer's friends list: accepted friends, pending requests both ways, and
 * the accounts they have blocked, each resolved from the viewer's side.
 */
export async function listFriends(viewerId: UserId): Promise<FriendSummary[]> {
  const db = requireDb()
  const rows = await db
    .selectFrom('friendships')
    .select(['requester_id', 'addressee_id', 'status'])
    .where((eb) => eb.or([eb('requester_id', '=', viewerId), eb('addressee_id', '=', viewerId)]))
    .execute()

  const visible = rows.filter((row) => isVisibleTo(row, viewerId))
  if (visible.length === 0) return []

  const others = [...new Set(visible.map((row) => otherUserId(row, viewerId)))]
  const users = await db
    .selectFrom('users')
    .select(USER_COLUMNS)
    .where('id', 'in', others)
    .execute()
  const byId = new Map(users.map((u) => [u.id, toUser(u)]))

  const summaries: FriendSummary[] = []
  for (const row of visible) {
    const user = byId.get(otherUserId(row, viewerId))
    const status = asFriendshipStatus(row.status)
    // A row whose account has since been deleted, or whose status column has
    // drifted: skip it rather than emit a half-built entry the UI can't render.
    if (!user || !status) continue
    const online = status === 'accepted' && isOnline(user.id)
    summaries.push({
      user,
      status,
      direction: directionFor(row, viewerId),
      online,
      // Only meaningful for a friend you could actually go and join.
      currentRoomId: online ? currentRoomOf(user.id) : null,
    })
  }
  // Stable order so the list doesn't reshuffle under the player on every push;
  // the client groups by status itself.
  summaries.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName))
  return summaries
}

/** The accepted friends of `userId` — who to tell when their presence changes. */
export async function acceptedFriendIds(userId: UserId): Promise<UserId[]> {
  const db = getDb()
  if (!db) return []
  const rows = await db
    .selectFrom('friendships')
    .select(['requester_id', 'addressee_id'])
    .where('status', '=', 'accepted')
    .where((eb) => eb.or([eb('requester_id', '=', userId), eb('addressee_id', '=', userId)]))
    .execute()
  return rows.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id))
}

/**
 * Whether either side of the pair has blocked the other.
 *
 * Exported for subtask G: a block has to stop room invites too, not just friend
 * requests, and G owns the invite path.
 */
export async function isBlockedBetween(a: UserId, b: UserId): Promise<boolean> {
  const db = getDb()
  if (!db) return false
  const row = await db
    .selectFrom('friendships')
    .select('id')
    .where('status', '=', 'blocked')
    .where((eb) => pairFilter(eb, a, b))
    .executeTakeFirst()
  return row !== undefined
}

async function findPair(
  db: ReturnType<typeof requireDb>,
  a: UserId,
  b: UserId,
): Promise<(FriendshipRow & { id: number }) | undefined> {
  return db
    .selectFrom('friendships')
    .select(['id', 'requester_id', 'addressee_id', 'status'])
    .where((eb) => pairFilter(eb, a, b))
    .executeTakeFirst()
}

// ---- Writes ----

export interface FriendRequestResult {
  target: User
  /**
   * True when the two players requested each other and this call closed the
   * loop. Both halves of a crossed request are the same intent, so the second
   * one accepts instead of failing with "there is already a pending request".
   */
  autoAccepted: boolean
}

/** Send a friend request to whoever owns `rawCode`. */
export async function sendFriendRequest(
  viewerId: UserId,
  rawCode: string,
): Promise<FriendRequestResult> {
  const db = requireDb()
  const code = normalizeFriendCode(rawCode)
  if (!code) throw new FriendsError('friends.codeInvalid')

  const targetRow = await db
    .selectFrom('users')
    .select(USER_COLUMNS)
    .where(sql<SqlBool>`upper(friend_code) = ${code}`)
    .executeTakeFirst()
  if (!targetRow) throw new FriendsError('friends.codeNotFound')

  const target = toUser(targetRow)
  if (target.id === viewerId) throw new FriendsError('friends.self')

  const existing = await findPair(db, viewerId, target.id)
  if (existing) {
    const status = asFriendshipStatus(existing.status)
    if (status === 'blocked') throw new FriendsError('friends.blocked')
    if (status === 'accepted') throw new FriendsError('friends.alreadyFriends')
    if (existing.requester_id === viewerId) throw new FriendsError('friends.requestPending')
    await db
      .updateTable('friendships')
      .set({ status: 'accepted' })
      .where('id', '=', existing.id)
      .execute()
    return { target, autoAccepted: true }
  }

  const pending = await db
    .selectFrom('friendships')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('requester_id', '=', viewerId)
    .where('status', '=', 'pending')
    .executeTakeFirst()
  if (Number(pending?.count ?? 0) >= MAX_PENDING_OUTGOING) {
    throw new FriendsError('friends.tooManyPending')
  }

  try {
    await db
      .insertInto('friendships')
      .values({ requester_id: viewerId, addressee_id: target.id, status: 'pending' })
      .execute()
  } catch (err) {
    // Both players hit send at the same moment. Either unique index (the
    // directional one from 0002 or the pair one from 0004) can fire; whichever
    // did, the pair now exists, so this is a duplicate, not a fault.
    if (isPgErrorCode(err, '23505')) throw new FriendsError('friends.requestPending')
    throw err
  }
  return { target, autoAccepted: false }
}

/** Accept or decline an INCOMING request. Only the addressee may answer one. */
export async function respondToRequest(
  viewerId: UserId,
  otherId: UserId,
  accept: boolean,
): Promise<void> {
  const db = requireDb()
  const result = accept
    ? await db
        .updateTable('friendships')
        .set({ status: 'accepted' })
        .where('requester_id', '=', otherId)
        .where('addressee_id', '=', viewerId)
        .where('status', '=', 'pending')
        .executeTakeFirst()
    : await db
        .deleteFrom('friendships')
        .where('requester_id', '=', otherId)
        .where('addressee_id', '=', viewerId)
        .where('status', '=', 'pending')
        .executeTakeFirst()

  const changed = accept
    ? ((result as { numUpdatedRows?: bigint }).numUpdatedRows ?? 0n)
    : ((result as { numDeletedRows?: bigint }).numDeletedRows ?? 0n)
  // Nothing matched: the request was withdrawn, already answered, or never
  // pointed this way. All of those are "gone", not "forbidden".
  if (changed === 0n) throw new FriendsError('friends.notFound')
}

/** Unfriend, or withdraw a request you sent. Blocks are lifted by `setBlocked`. */
export async function removeFriend(viewerId: UserId, otherId: UserId): Promise<void> {
  const db = requireDb()
  const result = await db
    .deleteFrom('friendships')
    .where((eb) => pairFilter(eb, viewerId, otherId))
    .where('status', '!=', 'blocked')
    .executeTakeFirst()
  if ((result.numDeletedRows ?? 0n) === 0n) throw new FriendsError('friends.notFound')
}

/**
 * Block or unblock a player. Blocking replaces whatever the pair was — request
 * or friendship — with a single blocked row, and rewrites `requester_id` to the
 * blocker so the row records who did it. Only that account can lift it.
 */
export async function setBlocked(
  viewerId: UserId,
  otherId: UserId,
  blocked: boolean,
): Promise<void> {
  const db = requireDb()
  if (viewerId === otherId) throw new FriendsError('friends.self')

  if (!blocked) {
    const result = await db
      .deleteFrom('friendships')
      .where('requester_id', '=', viewerId)
      .where('addressee_id', '=', otherId)
      .where('status', '=', 'blocked')
      .executeTakeFirst()
    if ((result.numDeletedRows ?? 0n) === 0n) throw new FriendsError('friends.notFound')
    return
  }

  const existing = await findPair(db, viewerId, otherId)
  if (existing) {
    await db
      .updateTable('friendships')
      .set({ requester_id: viewerId, addressee_id: otherId, status: 'blocked' })
      .where('id', '=', existing.id)
      .execute()
    return
  }
  try {
    await db
      .insertInto('friendships')
      .values({ requester_id: viewerId, addressee_id: otherId, status: 'blocked' })
      .execute()
  } catch (err) {
    // No such account (foreign key) — the id came off a stale list.
    if (isPgErrorCode(err, '23503')) throw new FriendsError('friends.notFound')
    // Raced against the other side creating the row; block wins, so retry once
    // as an update rather than reporting a fault.
    if (isPgErrorCode(err, '23505')) {
      const row = await findPair(db, viewerId, otherId)
      if (!row) throw err
      await db
        .updateTable('friendships')
        .set({ requester_id: viewerId, addressee_id: otherId, status: 'blocked' })
        .where('id', '=', row.id)
        .execute()
      return
    }
    throw err
  }
}
