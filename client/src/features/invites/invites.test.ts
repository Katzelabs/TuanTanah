import type { FriendSummary, User } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { invitableFriends } from './friends.js'
import { parseJoinability } from './joinability.js'

const user = (id: string, displayName: string): User => ({
  id,
  displayName,
  avatarUrl: null,
  friendCode: id.toUpperCase(),
  createdAt: '2026-08-01T00:00:00.000Z',
})

const friend = (
  id: string,
  displayName: string,
  extra: Partial<FriendSummary> = {},
): FriendSummary => ({
  user: user(id, displayName),
  status: 'accepted',
  direction: 'outgoing',
  online: false,
  currentRoomId: null,
  ...extra,
})

describe('invitableFriends', () => {
  it('puts online friends first, then sorts by name', () => {
    const list = invitableFriends([
      friend('a', 'Zainab'),
      friend('b', 'Budi', { online: true }),
      friend('c', 'Ayu'),
      friend('d', 'Andi', { online: true }),
    ])
    expect(list.map((f) => f.user.displayName)).toEqual(['Andi', 'Budi', 'Ayu', 'Zainab'])
  })

  it('drops anyone who is not an accepted friend', () => {
    // Pending requests and blocked accounts must never become an invite target —
    // an unanswered request is not consent to be pulled into a game.
    const list = invitableFriends([
      friend('a', 'Accepted'),
      friend('b', 'Pending', { status: 'pending', direction: 'incoming' }),
      friend('c', 'Blocked', { status: 'blocked' }),
    ])
    expect(list.map((f) => f.user.displayName)).toEqual(['Accepted'])
  })

  it("leaves the caller's array untouched", () => {
    const input = [friend('a', 'Zainab'), friend('b', 'Andi', { online: true })]
    invitableFriends(input)
    expect(input.map((f) => f.user.displayName)).toEqual(['Zainab', 'Andi'])
  })
})

describe('parseJoinability', () => {
  it('keeps the three blockers apart', () => {
    for (const reason of ['missing', 'started', 'full'] as const) {
      expect(parseJoinability({ joinable: false, reason })).toEqual({ joinable: false, reason })
    }
  })

  it('treats a malformed or unknown response as a room that is gone', () => {
    // Anything we can't read means we can't promise the room is there, and
    // "no longer exists" is the one blocker that is safe to be wrong about:
    // the player's next move is to ask their friend, not to keep retrying.
    expect(parseJoinability(null)).toEqual({ joinable: false, reason: 'missing' })
    expect(parseJoinability({ joinable: false })).toEqual({ joinable: false, reason: 'missing' })
    expect(parseJoinability({ joinable: false, reason: 'banana' })).toEqual({
      joinable: false,
      reason: 'missing',
    })
  })

  it('clears the reason on a joinable room', () => {
    expect(parseJoinability({ joinable: true, reason: 'full' })).toEqual({
      joinable: true,
      reason: null,
    })
  })
})
