// In-app feedback / bug reports (ClickUp 86eyr3xtu).
//
// One row per submission. Unlike the game archive this is not a summary of
// something that happened elsewhere — it IS the artefact, so it is written on
// the request path and a failure to write is reported to the person who typed it.
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('feedback')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('description', 'text', (c) => c.notNull())
    // Optional and free-text: an email, a Discord handle, whatever they gave us.
    .addColumn('contact', 'text')
    // The account behind the report, resolved from the session cookie — never
    // from the payload. NULL for guests, who are the reporters this feature most
    // needs to hear from. NULLed rather than cascaded on account deletion: the
    // bug outlives the reporter's account, and deleting an account should not
    // silently delete the evidence for a fix that is still outstanding.
    .addColumn('user_id', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    // Room it was filed from, when it came from inside a game. Deliberately not a
    // foreign key — rooms live in Redis and expire, so there is nothing to point at.
    .addColumn('room_id', 'text')
    .addColumn('app_version', 'text', (c) => c.notNull())
    .addColumn('build_sha', 'text', (c) => c.notNull())
    .addColumn('user_agent', 'text')
    // The rest of the auto-collected context (viewport, language, game snapshot).
    // jsonb rather than columns: it is read by a human triaging a report, never
    // filtered or joined on, and its shape will change as we learn what's useful.
    .addColumn('context', 'jsonb')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute()

  // Triage reads this newest-first and nothing else, so this is the only index
  // it needs.
  await db.schema
    .createIndex('feedback_created_at_idx')
    .on('feedback')
    .column('created_at')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('feedback').ifExists().execute()
}
