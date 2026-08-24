// Socket.io event payloads (tech doc §7). These are used to type the Socket.io
// server and client for end-to-end safety.

import type {
  GameState,
  LandBusiness,
  NegotiationDeal,
  PassType,
  Role,
  RoomSettings,
  RupiahAmount,
  TileId,
} from './game.js'
import type { LogParams } from '../i18n/params.js'
import type { FriendSummary, RoomInvite, User, UserId } from './auth.js'

export type MetaActionType =
  | 'judol'
  | 'work'
  | 'hustle'
  | 'lobby'
  | 'sabotage'
  | 'korupsi'
  | 'negotiate'

export interface FinalStanding {
  playerId: string
  name: string
  role: Role | null
  wealth: RupiahAmount
  eliminated: boolean
}

// ---- Client → Server ----
export interface ClientToServerEvents {
  join_room: (
    payload: { roomId: string; playerName: string },
    ack: (res: AckResult<{ roomId: string; playerId: string; token: string }>) => void,
  ) => void
  // `token` is the secret reconnect credential issued at join; it authenticates a
  // rejoin so a known playerId alone can't be used to hijack someone's seat.
  rejoin: (
    payload: { roomId: string; playerId: string; token: string },
    ack: (res: AckResult<{ roomId: string; playerId: string; token: string }>) => void,
  ) => void
  // Deliberate exit: leave the lobby (removed) or forfeit an in-progress game
  // (eliminated). Distinct from a socket disconnect, which keeps the seat.
  leave_room: () => void
  // Give up an in-progress game: the player is eliminated (forfeits like
  // leave_room) but keeps their seat/session so they stay connected and can
  // watch the rest of the game as a spectator.
  surrender: () => void
  // Read-only resync: re-send the caller the canonical state. Used when a tab
  // returns from the background (where rAF/timers froze and the UI may have
  // drifted) without a socket disconnect to trigger an auto-rejoin.
  request_state: () => void
  pick_role: (payload: { role: Role | null }) => void
  update_settings: (payload: { settings: Partial<RoomSettings> }) => void
  start_game: () => void

  roll_dice: () => void
  buy_property: (payload: { tileId: TileId }) => void
  upgrade_property: (payload: { tileId: TileId; track?: 'house' | 'property' }) => void
  // Build a business on an owned Lahan Kosong (buildable_land) tile.
  build_lahan: (payload: { tileId: TileId; business: LandBusiness }) => void
  // Kantor Hukum (law_office) landing actions — pick one, or skip.
  law_office_buy: (payload: { tileId: TileId }) => void
  law_office_transfer: (payload: { tileId: TileId }) => void
  law_office_jail: (payload: { targetPlayerId: string }) => void
  law_office_freepass: (payload: { pass: PassType }) => void
  law_office_upgrade_price: (payload: { tileId: TileId; multiplier: number }) => void
  law_office_skip: () => void
  // A Kantor Hukum force-buy opens an auction (law_office_transfer). The two
  // participants raise (auction_bid) or stop (auction_concede); highest bid wins.
  auction_bid: (payload: { amount: RupiahAmount }) => void
  auction_concede: () => void
  meta_action: (payload: {
    action: MetaActionType
    targetId?: string
    tileId?: TileId
    depositAmount?: RupiahAmount
  }) => void
  pay_jail: () => void
  take_pinjol: (payload: { amount: RupiahAmount; lenderId?: string }) => void
  // Rentenir's once-per-round loanshark power: force a rival to take a pinjol
  // funded by (and owed to) the Rentenir.
  force_pinjol: (payload: { targetId: string; amount: RupiahAmount }) => void
  // Voluntarily repay a pinjol loan's principal. Omit `loanId` to repay all loans.
  repay_pinjol: (payload: { loanId?: string }) => void
  propose_deal: (payload: { deal: NegotiationDeal }) => void
  respond_deal: (payload: { dealId: string; accept: boolean }) => void
  sell_property: (payload: { tileId: TileId }) => void
  downgrade_property: (payload: { tileId: TileId }) => void
  resolve_debt: (payload: { giveUp: boolean }) => void
  cast_vote: (payload: { targetId: string }) => void
  end_turn: () => void
  // DEV-only: move the current player straight to a tile (no dice) and resolve it.
  // The server ignores this outside dev builds (see `isDev`).
  dev_teleport: (payload: { tileId: TileId }) => void

  // ---- Accounts: friends (subtask F) ----
  // All of these require an authenticated socket; the server rejects them with
  // an `error` (code `core.requiresAccount`) for guests.
  //
  // Send a friend request by the target's short code (never by display name —
  // name search would allow enumerating players).
  friend_request: (payload: { friendCode: string }, ack: (res: AckResult<null>) => void) => void
  friend_respond: (
    payload: { userId: UserId; accept: boolean },
    ack: (res: AckResult<null>) => void,
  ) => void
  friend_remove: (payload: { userId: UserId }, ack: (res: AckResult<null>) => void) => void
  friend_block: (
    payload: { userId: UserId; blocked: boolean },
    ack: (res: AckResult<null>) => void,
  ) => void
  // Subscribe to the viewer's friends list. The server replies with the current
  // list and pushes `friends_updated` on every later change.
  friend_list: (ack: (res: AckResult<{ friends: FriendSummary[] }>) => void) => void

  // ---- Accounts: room invites (subtask G) ----
  // Invite an accepted friend into the room the caller is currently seated in.
  invite_to_room: (payload: { userId: UserId }, ack: (res: AckResult<null>) => void) => void
}

// ---- Server → Client ----
export interface ServerToClientEvents {
  game_state: (state: GameState) => void
  room_joined: (payload: { roomId: string; playerId: string }) => void
  card_drawn: (payload: { type: 'kejadian' | 'hustle'; card: string; playerId: string }) => void
  // Rent was charged because a player landed on an owned tile. Emitted alongside
  // the roll's state broadcast; the client plays the cue synced to the token's
  // arrival. Fires whether the rent was paid immediately or became a debt.
  rent_paid: (payload: {
    payerId: string
    ownerId: string
    tileId: TileId
    amount: RupiahAmount
  }) => void
  deal_proposed: (payload: { deal: NegotiationDeal }) => void
  player_eliminated: (payload: { playerId: string }) => void
  game_over: (payload: { winner: string; finalStandings: FinalStanding[] }) => void
  // `message` is the English fallback; `code` + `params` let the client localize.
  error: (payload: { message: string; code?: string; params?: LogParams }) => void

  // ---- Accounts: friends (subtask F) ----
  // The viewer's full friends list after any change (add/accept/remove/block) or
  // any presence transition. Sent only to the affected user's presence room.
  friends_updated: (payload: { friends: FriendSummary[] }) => void
  // A new incoming friend request arrived, for a toast/badge.
  friend_request_received: (payload: { from: User }) => void

  // ---- Accounts: room invites (subtask G) ----
  // A friend invited the viewer into a room. Delivered to every socket of the
  // target user, wherever they are in the app.
  room_invite: (payload: RoomInvite) => void
}

// Generic ack envelope for request/response style events.
export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string }
