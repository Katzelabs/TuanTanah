// Friends (ClickUp subtask F) — the two indexes the friends feature needs on top
// of the contract schema in 0002_auth. Migration number 0004 is the one reserved
// for subtask F in docs/PARALLEL_TICKETS.md.
//
// Additive only: it adds no columns and rewrites no rows, so 0002 stays the
// single owner of the friendship tables.
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // 0002 already has `unique (requester_id, addressee_id)`, but that constrains a
  // DIRECTION, not a pair: A→B and B→A are two distinct tuples, so both could be
  // inserted and the friendship would exist twice with two different statuses.
  // Ordering the pair inside the index makes the constraint what the schema
  // comment says it is — one row per pair, whichever way round it was created —
  // while `requester_id` stays free to record who acted (the requester while
  // pending, the blocker once blocked).
  await sql`
    create unique index if not exists friendships_pair_unique_idx
    on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  `.execute(db)

  // Friend codes are matched case-insensitively (players retype them off a
  // screenshot or a chat message), so the lookup is on upper(friend_code) and
  // needs its own expression index — the plain unique constraint on the column
  // can't serve it. Deliberately NOT unique: uniqueness of the raw code belongs
  // to 0002, and a unique expression index here could reject a code the
  // generator considers valid.
  await sql`
    create index if not exists users_friend_code_upper_idx on users (upper(friend_code))
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('users_friend_code_upper_idx').ifExists().execute()
  await db.schema.dropIndex('friendships_pair_unique_idx').ifExists().execute()
}
