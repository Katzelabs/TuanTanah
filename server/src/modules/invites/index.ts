// Room-invite policy (ClickUp subtask G): who may invite whom, and how often.
//
// Deliberately I/O-shaped but socket-free — `realtime/invites.ts` owns the
// transport, this owns the rules. Friendship is read straight from the contract
// schema (migration 0002_auth) rather than through the friends module, so this
// ticket doesn't depend on subtask F's server code having landed.
import type { UserId } from '@tuan-tanah/shared'
import { getDb } from '../../persistence/db.js'

/**
 * How the inviter stands with the target. `pending` friendships count as
 * `none`: a request you have not accepted must not become an invite channel.
 */
export type InviteRelation = 'accepted' | 'blocked' | 'none'

/**
 * Invites the same room may send to the same recipient. An invite is a push
 * notification the recipient did not ask for, so a friend who declines twice
 * stops hearing about that room rather than being re-poked every few seconds.
 */
export const MAX_INVITES_PER_ROOM_PER_RECIPIENT = 3

/** How long a room's invite budget for one recipient lasts before it resets. */
const INVITE_WINDOW_MS = 60 * 60 * 1000

/**
 * Resolve the friendship between two accounts. Friendships are stored once per
 * pair (see 0002_auth), so both column orders have to be checked.
 *
 * Returns `none` when Postgres is unconfigured: with no friend graph to read,
 * nobody is an accepted friend, and invites stay closed rather than open.
 */
export async function inviteRelation(from: UserId, to: UserId): Promise<InviteRelation> {
  const db = getDb()
  if (!db) return 'none'

  const row = await db
    .selectFrom('friendships')
    .select(['status'])
    .where((eb) =>
      eb.or([
        eb.and([eb('requester_id', '=', from), eb('addressee_id', '=', to)]),
        eb.and([eb('requester_id', '=', to), eb('addressee_id', '=', from)]),
      ]),
    )
    .executeTakeFirst()

  if (!row) return 'none'
  if (row.status === 'blocked') return 'blocked'
  return row.status === 'accepted' ? 'accepted' : 'none'
}

// Per (room, recipient) invite counters. In-process, like the connection caps in
// security.ts — a coarse first line of defence that a horizontally-scaled
// deployment would move to Redis. Losing the counters on restart only costs a
// recipient a few extra invites, never correctness.
const budgets = new Map<string, { used: number; resetAt: number }>()

const budgetKey = (roomId: string, to: UserId) => `${roomId}:${to}`

/**
 * Spend one invite from this room's budget for this recipient. Returns false
 * when the budget is exhausted — the caller should reject rather than deliver.
 */
export function claimInviteBudget(roomId: string, to: UserId, now = Date.now()): boolean {
  sweep(now)
  const key = budgetKey(roomId, to)
  const entry = budgets.get(key)
  if (!entry || entry.resetAt <= now) {
    budgets.set(key, { used: 1, resetAt: now + INVITE_WINDOW_MS })
    return true
  }
  if (entry.used >= MAX_INVITES_PER_ROOM_PER_RECIPIENT) return false
  entry.used += 1
  return true
}

let lastSweep = 0

/**
 * Drop expired counters. Without this the map grows by one entry per
 * (room, recipient) pair forever, which is the same unbounded-growth bug the
 * room store's TTL sweep exists to avoid.
 */
function sweep(now: number): void {
  if (now - lastSweep < INVITE_WINDOW_MS) return
  lastSweep = now
  for (const [key, entry] of budgets) {
    if (entry.resetAt <= now) budgets.delete(key)
  }
}

/** Test seam: forget every counter. */
export function resetInviteBudgets(): void {
  budgets.clear()
  lastSweep = 0
}
