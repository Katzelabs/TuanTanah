// The server sends one flat friends list; the panel shows four groups. The
// grouping rule lives here — one place, no socket, unit-testable — rather than
// inline in each section's JSX.
import type { FriendSummary } from '@tuan-tanah/shared'

export const incomingRequests = (friends: FriendSummary[]): FriendSummary[] =>
  friends.filter((f) => f.status === 'pending' && f.direction === 'incoming')

export const outgoingRequests = (friends: FriendSummary[]): FriendSummary[] =>
  friends.filter((f) => f.status === 'pending' && f.direction === 'outgoing')

/**
 * Accepted friends, online first — who you can actually go and play with right
 * now is the only thing this list is for. The server has already sorted by name,
 * and `sort` is stable, so alphabetical order survives inside each half.
 */
export const acceptedFriends = (friends: FriendSummary[]): FriendSummary[] =>
  friends.filter((f) => f.status === 'accepted').sort((a, b) => Number(b.online) - Number(a.online))

export const blockedUsers = (friends: FriendSummary[]): FriendSummary[] =>
  friends.filter((f) => f.status === 'blocked')
