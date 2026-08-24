// Account self-service: the data operations behind the settings page
// (ClickUp 86ey2z15r). HTTP wiring lives in ./accountRoutes.ts; the session
// contract lives in ./index.ts and belongs to subtask A.
//
// These are plain Kysely reads/writes — no game state, no sockets. They throw on
// a genuine database fault so the route layer can report it; "no such account"
// is a return value, not a throw.
import type { Selectable } from 'kysely'
import type { AuthUser } from '@tuan-tanah/shared'
import { getDb } from '../../persistence/db.js'
import type { UsersTable } from '../../persistence/schema.js'

/**
 * Display-name bounds. 20 matches the in-game name input on the home screen, so
 * a renamed account can't produce a seat label the board has no room for.
 */
export const DISPLAY_NAME_MAX = 20

/**
 * Trim, collapse runs of whitespace, and drop control characters. Returns null
 * when nothing usable is left — the caller turns that into a 400. Control
 * characters matter because this name is rendered on every other player's board:
 * a stray newline is a layout bug, not a nickname.
 */
export function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw
    // eslint-disable-next-line no-control-regex -- stripping C0/C1 is the point
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length === 0 || cleaned.length > DISPLAY_NAME_MAX) return null
  return cleaned
}

function toAuthUser(row: Selectable<UsersTable>): AuthUser {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    friendCode: row.friend_code,
    createdAt: row.created_at.toISOString(),
    // Nullable in the schema (a provider may withhold it); the page shows a
    // placeholder rather than an empty row.
    email: row.email ?? '',
  }
}

/** Rename an account. Null when the account no longer exists. */
export async function renameAccount(userId: string, displayName: string): Promise<AuthUser | null> {
  const db = getDb()
  if (!db) return null
  const row = await db
    .updateTable('users')
    .set({ display_name: displayName })
    .where('id', '=', userId)
    .returningAll()
    .executeTakeFirst()
  return row ? toAuthUser(row) : null
}

/**
 * Permanently delete an account. Returns false when it was already gone.
 *
 * The cascade is the schema's, not ours (see migrations/0002_auth.ts):
 * `auth_identities` and `friendships` are ON DELETE CASCADE, and
 * `game_players.user_id` is ON DELETE SET NULL — so archived games survive as
 * anonymous rows instead of disappearing with the player. One statement is also
 * one transaction; hand-rolled deletes could half-apply.
 */
export async function deleteAccount(userId: string): Promise<boolean> {
  const db = getDb()
  if (!db) return false
  const result = await db.deleteFrom('users').where('id', '=', userId).executeTakeFirst()
  return (result.numDeletedRows ?? 0n) > 0n
}
