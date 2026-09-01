// Kysely table types for the self-hosted Postgres game-history archive. These
// mirror the migration in ./migrations. Money columns are bigint in Postgres
// (rupiah can exceed int4) but are insert-only here, so a plain `number` suffices.
import type { Generated } from 'kysely'

export interface GamesTable {
  id: Generated<number>
  room_id: string
  winner_id: string
  win_condition: string | null
  duration_seconds: number | null
  player_count: number
  created_at: Generated<Date>
}

export interface GamePlayersTable {
  id: Generated<number>
  game_id: number
  player_id: string
  role: string
  final_cash: number
  final_wealth: number
  eliminated: boolean
  // Account that played this seat, or null for a guest. Also NULLed when an
  // account is deleted, so archived games survive as anonymous. See 0002_auth.
  user_id: string | null
}

// ---- Player accounts (ClickUp epic 86ey2z15b, migration 0002_auth) ----

export interface UsersTable {
  id: Generated<string>
  display_name: string
  avatar_url: string | null
  friend_code: string
  email: string | null
  created_at: Generated<Date>
}

export interface AuthIdentitiesTable {
  id: Generated<number>
  user_id: string
  /** Only 'google' for v1. A second provider is a new row, not a schema change. */
  provider: string
  /** The provider's stable subject id. Never key on email. */
  subject: string
  created_at: Generated<Date>
}

export interface FriendshipsTable {
  id: Generated<number>
  /** Stored once per pair — readers must check BOTH columns. */
  requester_id: string
  addressee_id: string
  /** 'pending' | 'accepted' | 'blocked' — see FriendshipStatus in shared. */
  status: string
  created_at: Generated<Date>
}

// ---- In-app feedback (ClickUp 86eyr3xtu, migration 0005_feedback) ----

export interface FeedbackTable {
  id: Generated<number>
  type: string
  title: string
  description: string
  contact: string | null
  /** Resolved from the session cookie, never from the payload. Null for guests. */
  user_id: string | null
  room_id: string | null
  app_version: string
  build_sha: string
  user_agent: string | null
  /** Viewport, language, and the compact game snapshot — see FeedbackContext. */
  context: unknown
  created_at: Generated<Date>
}

export interface Database {
  games: GamesTable
  game_players: GamePlayersTable
  users: UsersTable
  auth_identities: AuthIdentitiesTable
  friendships: FriendshipsTable
  feedback: FeedbackTable
}
