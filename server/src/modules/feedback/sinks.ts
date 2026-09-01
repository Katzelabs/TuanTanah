// Where a submitted report actually goes.
//
// Two independent sinks, each opt-in the same way DATABASE_URL and SENTRY_DSN
// are, because they answer different questions:
//
//   Postgres  — durable. Survives a restart, can be read back months later.
//   Discord   — visible. Lands in the channel the team already watches, which is
//               the acceptance criterion "reaches the team without manual polling".
//
// Neither is required, but at least one must be configured or the feature is off
// (`feedbackEnabled`). They are attempted independently: a Discord outage must
// not lose a report Postgres would have kept, and vice versa.
import { env } from '../../bootstrap/env.js'
import { reportError } from '../../observability/report.js'
import { insertFeedback, type FeedbackRecord } from '../../persistence/feedback.js'

/** Give up on the webhook rather than hold the reporter's request open. */
const WEBHOOK_TIMEOUT_MS = 5000

/** Discord's own caps. Exceeding any of them rejects the whole message. */
const EMBED_TITLE_MAX = 256
const EMBED_DESCRIPTION_MAX = 4096
const EMBED_FIELD_MAX = 1024

export interface DeliveryResult {
  /** A row was written to Postgres. */
  stored: boolean
  /** The webhook accepted the message. */
  notified: boolean
  /** At least one sink took it — the only thing the reporter needs to be true. */
  delivered: boolean
}

/** True when there is somewhere for a report to go. */
export function feedbackEnabled(): boolean {
  return Boolean(env.databaseUrl || env.feedbackWebhookUrl)
}

const TYPE_COLOR: Record<string, number> = {
  bug: 0xe5484d,
  suggestion: 0x3e63dd,
  other: 0x8e8e8e,
}

function field(name: string, value: string | null, inline = true) {
  return { name, value: (value || '—').slice(0, EMBED_FIELD_MAX), inline }
}

/**
 * Post the report to a Discord webhook.
 *
 * `allowed_mentions: { parse: [] }` is the important line: the title and body are
 * attacker-controlled text, and without it a report containing `@everyone` would
 * make the webhook ping the whole server. Neutralising mentions at the API level
 * is exact, where escaping the string by hand is a guessing game about Discord's
 * parser.
 */
async function notifyDiscord(record: FeedbackRecord, rowId: number | null): Promise<boolean> {
  const url = env.feedbackWebhookUrl
  if (!url) return false

  const { context } = record
  const game = context.game
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    body: JSON.stringify({
      username: 'Tuan Tanah',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: `[${record.type}] ${record.title}`.slice(0, EMBED_TITLE_MAX),
          description: record.description.slice(0, EMBED_DESCRIPTION_MAX),
          color: TYPE_COLOR[record.type] ?? TYPE_COLOR.other,
          timestamp: new Date().toISOString(),
          fields: [
            field('Build', `${context.appVersion} · ${context.buildSha}`),
            field('Reporter', record.userId ? `account ${record.userId}` : 'guest'),
            field('Contact', record.contact ?? null),
            field('Room', context.roomId),
            field(
              'Game',
              game ? `${game.phase} · round ${game.round} · ${game.playerCount}p` : null,
            ),
            // The archive id, so a triager reading Discord can find the full row.
            field('Row', rowId === null ? null : `#${rowId}`),
            field(
              'Client',
              `${context.viewportWidth}×${context.viewportHeight} · ${context.language}\n${context.userAgent}`,
              false,
            ),
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Discord webhook responded ${response.status}`)
  }
  return true
}

/**
 * Try every configured sink and report what landed.
 *
 * Deliberately does not throw: the caller needs to know how much got through so
 * it can tell the reporter the truth, and a partial success ("Postgres has it,
 * Discord is down") is a success from where they are standing. Each failure is
 * still reported — a silently broken sink is how a feedback channel becomes a
 * channel to nowhere.
 */
export async function deliverFeedback(record: FeedbackRecord): Promise<DeliveryResult> {
  let rowId: number | null = null
  let stored = false
  try {
    rowId = await insertFeedback(record)
    stored = rowId !== null
  } catch (err) {
    reportError(err, { at: 'feedback.insert', roomId: record.context.roomId ?? undefined })
  }

  let notified = false
  try {
    notified = await notifyDiscord(record, rowId)
  } catch (err) {
    reportError(err, { at: 'feedback.webhook' })
  }

  return { stored, notified, delivered: stored || notified }
}
