import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMe, parseMe } from './api.js'

const USER = {
  id: 'u1',
  displayName: 'Sri Mulyani',
  avatarUrl: null,
  friendCode: 'ABC123',
  createdAt: '2026-08-01T00:00:00.000Z',
  email: 'sri@example.com',
}

function mockFetch(impl: () => Promise<unknown> | never): void {
  vi.stubGlobal('fetch', vi.fn(impl))
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseMe', () => {
  it('accepts a bare account body', () => {
    expect(parseMe(USER)).toEqual({ user: USER, enabled: true })
  })

  it('accepts a { user } envelope', () => {
    expect(parseMe({ user: USER })).toEqual({ user: USER, enabled: true })
  })

  it('reads an explicit disabled flag', () => {
    expect(parseMe({ user: null, enabled: false })).toEqual({ user: null, enabled: false })
  })

  // A server that answered at all has the routes, so a guest body without an
  // `enabled` flag still means accounts work.
  it('treats a guest body with no flag as accounts-enabled', () => {
    expect(parseMe({ user: null })).toEqual({ user: null, enabled: true })
  })

  it('discards a malformed user rather than trusting it', () => {
    expect(parseMe({ user: { id: 'u1' } })).toEqual({ user: null, enabled: true })
    expect(parseMe('nope')).toEqual({ user: null, enabled: false })
  })
})

describe('fetchMe', () => {
  it('returns the signed-in account', async () => {
    mockFetch(async () => jsonResponse(USER))
    await expect(fetchMe()).resolves.toEqual({ user: USER, enabled: true })
  })

  it('treats 401 as a guest on a server that HAS accounts', async () => {
    mockFetch(async () => jsonResponse({}, 401))
    await expect(fetchMe()).resolves.toEqual({ user: null, enabled: true })
  })

  // No auth routes in this build — indistinguishable from accounts being off,
  // and a guest must see the same nothing either way.
  it('treats 404 as accounts disabled', async () => {
    mockFetch(async () => jsonResponse({}, 404))
    await expect(fetchMe()).resolves.toEqual({ user: null, enabled: false })
  })

  it('never throws when the backend is unreachable', async () => {
    mockFetch(() => Promise.reject(new Error('offline')))
    await expect(fetchMe()).resolves.toEqual({ user: null, enabled: false })
  })
})
