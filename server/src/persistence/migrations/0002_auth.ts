// Player accounts: users, their external auth identities, and friendships — plus
// a nullable link from archived game rows to the account that played them.
//
// CONTRACT MIGRATION (ClickUp epic 86ey2z15b). Written up front so subtasks A–G
// can be built in parallel against one agreed schema. Later tickets in the epic
// must NOT add competing migrations for these tables; reserved numbers are
// listed in docs/PARALLEL_TICKETS.md.
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('display_name', 'text', (c) => c.notNull())
    // Deliberately NOT Google's avatar URL — hotlinking it is blocked by the
    // shared platform CSP, so this stays null until we host avatars ourselves.
    .addColumn('avatar_url', 'text')
    // Short shareable code for friend requests (subtask F). Unique so a lookup
    // by code is unambiguous; name search is deliberately not supported.
    .addColumn('friend_code', 'text', (c) => c.notNull().unique())
    .addColumn('email', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute()

  // One row per external provider identity. Keyed on the provider's stable
  // subject id, never on email — people change those.
  await db.schema
    .createTable('auth_identities')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('provider', 'text', (c) => c.notNull())
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('auth_identities_provider_subject_key', ['provider', 'subject'])
    .execute()

  await db.schema
    .createIndex('auth_identities_user_id_idx')
    .on('auth_identities')
    .column('user_id')
    .execute()

  // Friendship is stored ONCE per pair, not once per direction. `requester_id`
  // records who initiated (so a pending request knows its direction); the unique
  // constraint stops A→B and B→A both existing. Readers must check both columns.
  await db.schema
    .createTable('friendships')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('requester_id', 'uuid', (c) =>
      c.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('addressee_id', 'uuid', (c) =>
      c.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('friendships_pair_key', ['requester_id', 'addressee_id'])
    .addCheckConstraint('friendships_no_self', sql`requester_id <> addressee_id`)
    .execute()

  await db.schema
    .createIndex('friendships_addressee_idx')
    .on('friendships')
    .column('addressee_id')
    .execute()

  // Attribute an archived result to an account. NULL for guests, and NULLed on
  // account deletion so history survives as anonymous rather than vanishing.
  await db.schema
    .alterTable('game_players')
    .addColumn('user_id', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .execute()

  await db.schema
    .createIndex('game_players_user_id_idx')
    .on('game_players')
    .column('user_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('game_players_user_id_idx').ifExists().execute()
  await db.schema.alterTable('game_players').dropColumn('user_id').execute()
  await db.schema.dropTable('friendships').ifExists().execute()
  await db.schema.dropTable('auth_identities').ifExists().execute()
  await db.schema.dropTable('users').ifExists().execute()
}
