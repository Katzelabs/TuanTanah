// feedback — in-app bug reports and suggestions (ClickUp 86eyr3xtu).
//
//   GET  /api/feedback/config  -> { enabled }
//   POST /api/feedback         -> 201 { ok: true } | { error: FeedbackErrorCode }
//
// A feature seam like `../auth` and `../history`: the HTTP surface lives here,
// delivery lives in `./sinks.ts`, the durable write in
// `persistence/feedback.ts`. Nothing in the engine or the realtime layer knows
// this exists — a report is filed over HTTP so it works from inside a live game
// without touching the socket the game is running on.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { FeedbackErrorCode } from '@tuan-tanah/shared'
import { reportError } from '../../observability/report.js'
import { clientIpFrom } from '../../security.js'
import { readSessionCookie } from '../auth/cookie.js'
import { resolveSession } from '../auth/index.js'
import { deliverFeedback, feedbackEnabled } from './sinks.js'
import { parseSubmission } from './validate.js'

/**
 * Per-reporter submission budget.
 *
 * Well above any honest use — nobody files ten distinct bug reports in ten
 * minutes — while keeping an open, unauthenticated form from being a spam relay
 * into the team's Discord. Generous rather than tight on purpose: the failure
 * mode of a limit that is too low (a real reporter silently blocked) costs more
 * than the failure mode of one that is slightly too high.
 */
const RATE_LIMIT = { max: 10, timeWindow: '10 minutes' } as const

function fail(reply: FastifyReply, status: number, error: FeedbackErrorCode) {
  return reply.code(status).send({ error })
}

export function registerFeedbackRoutes(app: FastifyInstance): void {
  // Lets the client hide its entry points on a deployment with nowhere to send
  // reports, rather than offering a button that can only ever fail.
  app.get('/api/feedback/config', async () => ({ enabled: feedbackEnabled() }))

  app.post(
    '/api/feedback',
    {
      config: {
        rateLimit: {
          ...RATE_LIMIT,
          // Fastify does not trust proxies by default, so `request.ip` behind the
          // platform edge is the edge itself — every reporter in the world would
          // share one bucket and the tenth report of the day would lock out the
          // eleventh person. Key on the forwarded address instead, resolved the
          // same way the socket limiter resolves it.
          keyGenerator: (request: FastifyRequest) =>
            clientIpFrom(request.headers['x-forwarded-for'], request.ip),
        },
      },
    },
    async (request, reply) => {
      // Checked before validation so a deployment with no sink says so plainly
      // instead of blaming the reporter's input.
      if (!feedbackEnabled()) return fail(reply, 503, 'unavailable')

      const submission = parseSubmission(request.body)
      if (!submission) return fail(reply, 400, 'invalid')

      // Identity comes from the cookie, never from the payload — a client-sent
      // user id is a claim, and honouring it would let anyone file in someone
      // else's name. A guest resolves to null, which is a completely normal and
      // deliberately supported way to report.
      const session = await resolveSession(readSessionCookie(request.headers.cookie))

      const result = await deliverFeedback({ ...submission, userId: session?.userId ?? null })

      if (!result.delivered) {
        // Every sink already reported its own failure; this one records that the
        // reporter was turned away, which is the part that costs us a report.
        reportError(new Error('feedback delivery failed on every sink'), {
          at: 'feedback.submit',
          userId: session?.userId,
        })
        return fail(reply, 502, 'unavailable')
      }

      return reply.code(201).send({ ok: true })
    },
  )
}
