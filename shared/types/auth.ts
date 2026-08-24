// Account, friendship, and invite types — the contract shared by client and
// server for the player-accounts feature (ClickUp epic 86ey2z15b).
//
// CONTRACT MODULE. These shapes are agreed up front so subtasks A–G can be built
// in parallel against a fixed seam. Changing anything here affects every ticket
// in the epic — coordinate before editing, don't widen it locally.
import type { Role, RupiahAmount } from './game.js'

/** Server-generated account id (uuid). Distinct from the per-game `playerId`. */
export type UserId = string

/** A player account as seen by ANYONE (safe to broadcast — no email). */
export interface User {
  id: UserId
  displayName: string
  /** Null unless the player set one. We deliberately do not store Google's URL. */
  avatarUrl: string | null
  /** Short shareable code used to send friend requests. See subtask F. */
  friendCode: string
  createdAt: string
}

/** The viewer's OWN account (adds private fields). Returned by GET /api/auth/me. */
export interface AuthUser extends User {
  email: string
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'

/** A row in the viewer's friends list, resolved from their perspective. */
export interface FriendSummary {
  user: User
  status: FriendshipStatus
  /** Who initiated — meaningful while status is 'pending'. */
  direction: 'incoming' | 'outgoing'
  /** Live presence: has at least one connected socket. See subtask F. */
  online: boolean
  /** Room code they're currently in, when online and joinable. */
  currentRoomId: string | null
}

/** One completed game in a signed-in player's history. See subtask E. */
export interface MatchHistoryEntry {
  gameId: number
  playedAt: string
  role: Role | null
  finalWealth: RupiahAmount
  eliminated: boolean
  won: boolean
  playerCount: number
}

/** A friend inviting the viewer into a room. See subtask G. */
export interface RoomInvite {
  roomId: string
  from: User
  sentAt: string
}
