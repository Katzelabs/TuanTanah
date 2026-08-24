// Account settings routes (ClickUp 86ey2z15r). Two things are worth pinning
// down here and neither is visible at the call site:
//
//  1. The auth check runs BEFORE anything else, so an unauthenticated request
//     can't probe whether an account exists or push work at the database.
//  2. Deleting revokes the session, and revokes it only after the row is
//     actually gone — a failed delete must leave the player signed in.
//
// The data layer is stubbed: `renameAccount`/`deleteAccount` are thin Kysely
// statements whose real behaviour (the ON DELETE cascade) belongs to Postgres,
// not to a unit test.
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeDisplayName } from '../src/modules/auth/account.js'
import {
  SESSION_COOKIE,
  registerAccountRoutes,
  type AccountRoutesDeps,
} from '../src/modules/auth/accountRoutes.js'

vi.mock('../src/modules/auth/account.js', async () => {
  const actual = await vi.importActual<typeof import('../src/modules/auth/account.js')>(
    '../src/modules/auth/account.js',
  )
  return { ...actual, renameAccount: vi.fn(), deleteAccount: vi.fn() }
})

const { renameAccount, deleteAccount } = await import('../src/modules/auth/account.js')
const renameMock = vi.mocked(renameAccount)
const deleteMock = vi.mocked(deleteAccount)

const USER = {
  id: 'user-1',
  displayName: 'Budi',
  avatarUrl: null,
  friendCode: 'TT-4KQ2',
  createdAt: '2026-08-01T00:00:00.000Z',
  email: 'budi@example.com',
}

const SIGNED_IN = { cookie: `${SESSION_COOKIE}=token-1` }

let app: FastifyInstance
let destroySession: ReturnType<typeof vi.fn>

beforeEach(async () => {
  destroySession = vi.fn(async () => {})
  const deps: AccountRoutesDeps = {
    resolveSession: async (token) =>
      token === 'token-1' ? { userId: USER.id, sessionId: 'sess-1' } : null,
    destroySession,
  }
  app = Fastify()
  registerAccountRoutes(app, deps)
  await app.ready()
})

afterEach(async () => {
  await app.close()
  vi.clearAllMocks()
})

describe('normalizeDisplayName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeDisplayName('  Bu   di  ')).toBe('Bu di')
  })

  it('strips control characters rather than storing them', () => {
    expect(normalizeDisplayName('Bu\ndi')).toBe('Bu di')
    expect(normalizeDisplayName('Budi\u0000')).toBe('Budi')
  })

  it('rejects empty, whitespace-only, over-long and non-string names', () => {
    expect(normalizeDisplayName('')).toBeNull()
    expect(normalizeDisplayName('   ')).toBeNull()
    expect(normalizeDisplayName('x'.repeat(21))).toBeNull()
    expect(normalizeDisplayName(42)).toBeNull()
  })
})

describe('PATCH /api/account', () => {
  it('renames the account behind the session', async () => {
    renameMock.mockResolvedValue({ ...USER, displayName: 'Budi Baru' })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/account',
      headers: SIGNED_IN,
      payload: { displayName: '  Budi Baru ' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ user: { ...USER, displayName: 'Budi Baru' } })
    // Normalised before it reaches the database, not after it comes back.
    expect(renameMock).toHaveBeenCalledWith(USER.id, 'Budi Baru')
  })

  it('rejects a guest without touching the database', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/account',
      payload: { displayName: 'Budi Baru' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'unauthenticated' })
    expect(renameMock).not.toHaveBeenCalled()
  })

  it('rejects an unusable name with a code the client can localise', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/account',
      headers: SIGNED_IN,
      payload: { displayName: '   ' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'invalid_name' })
    expect(renameMock).not.toHaveBeenCalled()
  })

  it('reports a database fault instead of leaking it to the player', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    renameMock.mockRejectedValue(new Error('connection terminated'))

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/account',
      headers: SIGNED_IN,
      payload: { displayName: 'Budi Baru' },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'unavailable' })
    expect(stderr).toHaveBeenCalledOnce()
    expect(String(stderr.mock.calls[0]?.[0])).toContain('accountRoutes.rename')
    stderr.mockRestore()
  })
})

describe('DELETE /api/account', () => {
  it('deletes the account and revokes the session', async () => {
    deleteMock.mockResolvedValue(true)

    const res = await app.inject({ method: 'DELETE', url: '/api/account', headers: SIGNED_IN })

    expect(res.statusCode).toBe(204)
    expect(deleteMock).toHaveBeenCalledWith(USER.id)
    expect(destroySession).toHaveBeenCalledWith('token-1')
  })

  it('rejects a guest', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/account' })

    expect(res.statusCode).toBe(401)
    expect(deleteMock).not.toHaveBeenCalled()
    expect(destroySession).not.toHaveBeenCalled()
  })

  // A half-applied delete that also signed the player out would leave them with
  // no way back in to retry.
  it('keeps the session alive when the delete fails', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    deleteMock.mockRejectedValue(new Error('connection terminated'))

    const res = await app.inject({ method: 'DELETE', url: '/api/account', headers: SIGNED_IN })

    expect(res.statusCode).toBe(500)
    expect(destroySession).not.toHaveBeenCalled()
    stderr.mockRestore()
  })
})
