// Ordering the invite picker renders: accepted friends only, online first.
//
// Split out of the store so it can be unit-tested without pulling in the socket
// singleton (importing the store opens a real connection under jsdom).
import type { FriendSummary } from '@tuan-tanah/shared'

/** Accepted friends only, online first, then alphabetical. */
export function invitableFriends(friends: FriendSummary[]): FriendSummary[] {
  return friends
    .filter((f) => f.status === 'accepted')
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1
      return a.user.displayName.localeCompare(b.user.displayName)
    })
}
