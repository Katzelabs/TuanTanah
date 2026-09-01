// In-app feedback (ClickUp 86eyr3xtu). Four things are worth pinning down, and
// none of them is obvious at the call site:
//
//  1. Validation rejects only what a human actually typed. Auto-collected
//     context is best-effort — a broken viewport number must never lose the
//     report attached to it.
//  2. The reporter's identity comes from the session cookie, never the payload.
//  3. A submission that reached NO sink is an error the reporter is told about,
//     not a silent success. This is the opposite of the game-history archive.
//  4. With nothing configured the route says so instead of blaming the input.
//
// The sinks are stubbed: Postgres and a Discord webhook are I/O, and what
// matters here is which outcome the route turns them into.
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEEDBACK_DESCRIPTION_MAX, FEEDBACK_TITLE_MAX } from '@tuan-tanah/shared'
import { parseSubmission } from '../src/modules/feedback/validate.js'

vi.mock('../src/modules/feedback/sinks.js', () => ({
  feedbackEnabled: vi.fn(() => true),
  deliverFeedback: vi.fn(async () => ({ stored: true, notified: true, delivered: true })),
}))

vi.mock('../src/modules/auth/index.js', () => ({
  resolveSession: vi.fn(async (token?: string) =>
    token === 'good-token' ? { userId: 'user-1', sessionId: 'sess-1' } : null,
  ),
}))

const { feedbackEnabled, deliverFeedback } = await import('../src/modules/feedback/sinks.js')
const { registerFeedbackRoutes } = await import('../src/modules/feedback/index.js')
const enabledMock = vi.mocked(feedbackEnabled)
const deliverMock = vi.mocked(deliverFeedback)

const CONTEXT = {
  appVersion: '0.2.0',
  buildSha: 'abc1234',
  userAgent: 'Mozilla/5.0 (Test)',
  language: 'id',
  viewportWidth: 390,
  viewportHeight: 844,
  roomId: 'ABC123',
  game: {
    phase: 'playing',
    round: 4,
    currentPlayerId: 'p2',
    myPlayerId: 'p1',
    playerCount: 3,
  },
}

const BODY = {
  type: 'bug',
  title: 'Dice roll did nothing',
  description: 'I pressed roll and my token never moved.',
  context: CONTEXT,
}

let app: FastifyInstance

beforeEach(async () => {
  enabledMock.mockReturnValue(true)
  deliverMock.mockResolvedValue({ stored: true, notified: true, delivered: true })
  app = Fastify()
  registerFeedbackRoutes(app)
  await app.ready()
})

afterEach(async () => {
  await app.close()
  vi.clearAllMocks()
})

describe('parseSubmission', () => {
  it('accepts a well-formed report', () => {
    const parsed = parseSubmission(BODY)
    expect(parsed?.type).toBe('bug')
    expect(parsed?.title).toBe('Dice roll did nothing')
    expect(parsed?.context.roomId).toBe('ABC123')
    expect(parsed?.context.game?.round).toBe(4)
  })

  it.each([
    ['a missing body', null],
    ['an unknown type', { ...BODY, type: 'spam' }],
    ['a blank title', { ...BODY, title: '   ' }],
    ['a blank description', { ...BODY, description: '' }],
    ['a non-string title', { ...BODY, title: 42 }],
  ])('rejects %s', (_label, body) => {
    expect(parseSubmission(body)).toBeNull()
  })

  it('keeps newlines in the description but flattens them in the title', () => {
    const parsed = parseSubmission({
      ...BODY,
      title: 'one\ntwo',
      description: 'step one\nstep two',
    })
    // Reproduction steps are the whole value of a description — losing its line
    // breaks would run them into one unreadable paragraph.
    expect(parsed?.description).toBe('step one\nstep two')
    expect(parsed?.title).toBe('one two')
  })

  it('truncates rather than rejects over-long text', () => {
    const parsed = parseSubmission({
      ...BODY,
      title: 'x'.repeat(FEEDBACK_TITLE_MAX + 50),
      description: 'y'.repeat(FEEDBACK_DESCRIPTION_MAX + 50),
    })
    expect(parsed?.title).toHaveLength(FEEDBACK_TITLE_MAX)
    expect(parsed?.description).toHaveLength(FEEDBACK_DESCRIPTION_MAX)
  })

  it('survives junk context without losing the report', () => {
    const parsed = parseSubmission({
      ...BODY,
      context: { appVersion: 12, viewportWidth: Number.NaN, game: 'not an object' },
    })
    expect(parsed).not.toBeNull()
    expect(parsed?.context.appVersion).toBe('unknown')
    expect(parsed?.context.viewportWidth).toBe(0)
    expect(parsed?.context.game).toBeNull()
  })

  it('drops a payload-supplied user id', () => {
    // Identity is the server's to decide. Anything the client claims here must
    // not survive into the record.
    const parsed = parseSubmission({ ...BODY, userId: 'someone-else' })
    expect(parsed).not.toBeNull()
    expect(parsed as unknown as Record<string, unknown>).not.toHaveProperty('userId')
  })
})

describe('POST /api/feedback', () => {
  it('accepts a guest report', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/feedback', payload: BODY })
    expect(res.statusCode).toBe(201)
    expect(deliverMock).toHaveBeenCalledWith(expect.objectContaining({ userId: null }))
  })

  it('attributes a report to the account behind the cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: BODY,
      headers: { cookie: 'tt_session=good-token' },
    })
    expect(res.statusCode).toBe(201)
    expect(deliverMock).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }))
  })

  it('ignores a user id the client tried to supply', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: { ...BODY, userId: 'admin' },
    })
    expect(deliverMock).toHaveBeenCalledWith(expect.objectContaining({ userId: null }))
  })

  it('rejects an invalid submission without calling any sink', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: { ...BODY, title: '' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'invalid' })
    expect(deliverMock).not.toHaveBeenCalled()
  })

  it('tells the reporter when nothing accepted the report', async () => {
    deliverMock.mockResolvedValue({ stored: false, notified: false, delivered: false })
    const res = await app.inject({ method: 'POST', url: '/api/feedback', payload: BODY })
    // The whole point of the feature is that a report reaches someone. A 201
    // here would thank the reporter for nothing.
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'unavailable' })
  })

  it('counts a partial delivery as success', async () => {
    // Postgres has it; Discord was down. From the reporter's side that is a
    // report we hold, so it is not a failure to hand back.
    deliverMock.mockResolvedValue({ stored: true, notified: false, delivered: true })
    const res = await app.inject({ method: 'POST', url: '/api/feedback', payload: BODY })
    expect(res.statusCode).toBe(201)
  })

  it('reports itself unavailable when no sink is configured', async () => {
    enabledMock.mockReturnValue(false)
    const res = await app.inject({ method: 'POST', url: '/api/feedback', payload: BODY })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ error: 'unavailable' })
    expect(deliverMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/feedback/config', () => {
  it('advertises availability so the client can hide a dead entry point', async () => {
    enabledMock.mockReturnValue(false)
    const res = await app.inject({ method: 'GET', url: '/api/feedback/config' })
    expect(res.json()).toEqual({ enabled: false })
  })
})
