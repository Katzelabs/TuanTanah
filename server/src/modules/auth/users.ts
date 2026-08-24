// Account rows: turning a Google identity into a `users` row, and reading one
// back. The only place in the server that writes to `users`/`auth_identities`.
import type { AuthUser, UserId } from '@tuan-tanah/shared'
import { getDb } from '../../persistence/db.js'
import type { GoogleProfile } from './google.js'

const PROVIDER = 'google'

/** Postgres unique-violation. Used to tell a lost race from a real failure. */
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === UNIQUE_VIOLATION
}

// No I/1/O/0 — a friend code gets read off a screen and typed by someone else,
// so the alphabet excludes every pair that is ambiguous in a sans-serif font.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
const CODE_LENGTH = 8
// 30^8 ≈ 6.6e11 codes. A collision at our scale is vanishingly unlikely, but the
// column is UNIQUE, so a lost race must retry rather than fail the sign-in.
const CODE_ATTEMPTS = 5

function randomFriendCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

const MAX_DISPLAY_NAME = 32

/**
 * Seed a display name from what Google gave us. Falls back to the email's local
 * part, then to a generic label — a blank name would render as an empty seat.
 */
function seedDisplayName(profile: GoogleProfile): string {
  const fromName = profile.name?.trim()
  if (fromName) return fromName.slice(0, MAX_DISPLAY_NAME)
  const localPart = profile.email?.split('@')[0]?.trim()
  if (localPart) return localPart.slice(0, MAX_DISPLAY_NAME)
  return 'Pemain'
}

function requireDb() {
  const db = getDb()
  if (!db) {
    // Unreachable while `authEnabled()` also requires DATABASE_URL, but accounts
    // have nowhere to live without it and a clear throw beats a null deref.
    throw new Error('Accounts require DATABASE_URL; refusing to sign in without storage')
  }
  return db
}

/**
 * Find the account behind a Google identity, creating it on first sign-in.
 *
 * Keyed on `sub`, the provider's stable subject id — never on email, which people
 * change and which Google can reassign within a Workspace domain.
 */
export async function upsertGoogleUser(profile: GoogleProfile): Promise<UserId> {
  const db = requireDb()

  const existing = await db
    .selectFrom('auth_identities')
    .select('user_id')
    .where('provider', '=', PROVIDER)
    .where('subject', '=', profile.sub)
    .executeTakeFirst()

  if (existing) {
    // Keep the address current for account recovery/contact, but leave
    // display_name alone: the player may have set their own (subtask D), and
    // overwriting it on every sign-in would silently undo that.
    if (profile.email) {
      await db
        .updateTable('users')
        .set({ email: profile.email })
        .where('id', '=', existing.user_id)
        .execute()
    }
    return existing.user_id
  }

  const displayName = seedDisplayName(profile)

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      // One transaction: a friend-code collision or a concurrent sign-in for the
      // same `sub` must not leave an orphan `users` row with no identity.
      return await db.transaction().execute(async (trx) => {
        const user = await trx
          .insertInto('users')
          .values({
            display_name: displayName,
            friend_code: randomFriendCode(),
            email: profile.email,
          })
          .returning('id')
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('auth_identities')
          .values({ user_id: user.id, provider: PROVIDER, subject: profile.sub })
          .execute()

        return user.id
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      // Either the friend code collided (retry gets a new one) or a concurrent
      // request created this identity first — in which case re-reading wins.
      const raced = await db
        .selectFrom('auth_identities')
        .select('user_id')
        .where('provider', '=', PROVIDER)
        .where('subject', '=', profile.sub)
        .executeTakeFirst()
      if (raced) return raced.user_id
    }
  }

  throw new Error('Could not allocate a unique friend code')
}

/** Load an account by id. Null when it no longer exists (deleted mid-session). */
export async function loadUser(userId: UserId): Promise<AuthUser | null> {
  const db = getDb()
  if (!db) return null

  const row = await db
    .selectFrom('users')
    .select(['id', 'display_name', 'avatar_url', 'friend_code', 'email', 'created_at'])
    .where('id', '=', userId)
    .executeTakeFirst()

  if (!row) return null
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    friendCode: row.friend_code,
    // The column is nullable (a provider need not supply one); the client type
    // is not, so an account without an address reads as blank rather than null.
    email: row.email ?? '',
    createdAt: row.created_at.toISOString(),
  }
}
