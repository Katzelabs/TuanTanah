// social — friends and presence (ClickUp subtask F of the player-accounts epic).
//
// `friends.ts` owns the durable half (Postgres, via the `friendships` table from
// migration 0002_auth) and `presence.ts` the volatile half (who is connected
// right now). The socket handlers that drive both live in
// `../../realtime/friends.ts`; this barrel is what the rest of the server —
// notably subtask G's room invites — imports.
export {
  acceptedFriendIds,
  FriendsError,
  isBlockedBetween,
  listFriends,
  MAX_PENDING_OUTGOING,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
  setBlocked,
  type FriendRequestResult,
} from './friends.js'

export {
  attachPresence,
  currentRoomOf,
  detachPresence,
  isOnline,
  onlineAmong,
  presenceRoom,
  resetPresence,
  type PresenceSocket,
} from './presence.js'

export {
  asFriendshipStatus,
  canonicalPair,
  directionFor,
  isVisibleTo,
  normalizeFriendCode,
  otherUserId,
  type FriendshipRow,
} from './pairs.js'
