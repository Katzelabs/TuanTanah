// Durable storage for in-app feedback (ClickUp 86eyr3xtu).
//
// The one place in `persistence/` that is allowed to throw at its caller.
// `gameHistory` is best-effort archival of something that already happened, so a
// failed write must never disturb a live game. A feedback row IS the artefact —
// if it doesn't land, the report is gone and the person who wrote it is entitled
// to know that instead of being thanked for nothing.
import type { FeedbackSubmission } from '@tuan-tanah/shared'
import { getDb } from './db.js'

export interface FeedbackRecord extends FeedbackSubmission {
  /** Resolved from the session cookie by the route. Null for guests. */
  userId: string | null
}

/**
 * Insert one report. Returns its row id, or `null` when Postgres isn't
 * configured — which is not a failure, just a deployment without an archive.
 * Any real database error propagates.
 */
export async function insertFeedback(record: FeedbackRecord): Promise<number | null> {
  const db = getDb()
  if (!db) return null

  const { context } = record
  const row = await db
    .insertInto('feedback')
    .values({
      type: record.type,
      title: record.title,
      description: record.description,
      contact: record.contact ?? null,
      user_id: record.userId,
      room_id: context.roomId,
      app_version: context.appVersion,
      build_sha: context.buildSha,
      user_agent: context.userAgent,
      // The columns above are the ones worth querying; the rest rides along as
      // jsonb for whoever is reading the report.
      context: JSON.stringify({
        language: context.language,
        viewportWidth: context.viewportWidth,
        viewportHeight: context.viewportHeight,
        game: context.game,
      }),
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  return row.id
}
