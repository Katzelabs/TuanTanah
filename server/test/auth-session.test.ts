// The session half of the auth contract (server/src/modules/auth/index.ts).
//
// These run against whichever backend the environment gives them — the in-memory
// fallback with REDIS_URL blank, real Redis when it is set. Both must behave
// identically, which is the point: local dev without Docker is a supported way to
// exercise sign-in, so the fallback cannot be a second, subtly different store.
import { describe, expect, it } from 'vitest'
import { readSessionCookie } from '../src/modules/auth/cookie.js'
import { createSession, destroySession, resolveSession } from '../src/modules/auth/index.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'

describe('auth sessions', () => {
  it('resolves a session it issued', async () => {
    const token = await createSession(USER_ID)
    const session = await resolveSession(token)
    expect(session).toEqual({ userId: USER_ID, sessionId: token })
  })

  it('treats a missing cookie as a guest rather than an error', async () => {
    expect(await resolveSession(undefined)).toBeNull()
    expect(await resolveSession('')).toBeNull()
  })

  it('rejects a token it never issued', async () => {
    expect(await resolveSession('not-a-real-session-token')).toBeNull()
  })

  it('revokes on logout, and revoking twice is a no-op', async () => {
    const token = await createSession(USER_ID)
    await destroySession(token)
    expect(await resolveSession(token)).toBeNull()
    await expect(destroySession(token)).resolves.toBeUndefined()
  })

  it('issues unguessable, unique tokens', async () => {
    const tokens = await Promise.all(Array.from({ length: 20 }, () => createSession(USER_ID)))
    expect(new Set(tokens).size).toBe(tokens.length)
    // 32 random bytes in base64url — 43 characters, no padding.
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
  })

  it('keeps sessions independent — revoking one leaves the others signed in', async () => {
    const [a, b] = await Promise.all([createSession(USER_ID), createSession(USER_ID)])
    await destroySession(a)
    expect(await resolveSession(a)).toBeNull()
    expect((await resolveSession(b))?.userId).toBe(USER_ID)
  })
})

describe('session cookie parsing', () => {
  it('finds the token among other cookies, whatever the spacing', () => {
    expect(readSessionCookie('tt_session=abc123')).toBe('abc123')
    expect(readSessionCookie('a=1; tt_session=abc123; b=2')).toBe('abc123')
    expect(readSessionCookie('a=1;tt_session=abc123;b=2')).toBe('abc123')
  })

  it('returns nothing when there is no session cookie', () => {
    expect(readSessionCookie(undefined)).toBeUndefined()
    expect(readSessionCookie('')).toBeUndefined()
    expect(readSessionCookie('other=1; another=2')).toBeUndefined()
    expect(readSessionCookie('tt_session=')).toBeUndefined()
  })

  // A prefix match would hand `xtt_session` / `tt_session_old` straight through
  // as if it were the real thing.
  it('matches the cookie name exactly', () => {
    expect(readSessionCookie('xtt_session=abc123')).toBeUndefined()
    expect(readSessionCookie('tt_session_old=abc123')).toBeUndefined()
    expect(readSessionCookie('tt_session_old=nope; tt_session=yes')).toBe('yes')
  })

  it('decodes percent-encoding, and survives a malformed value', () => {
    expect(readSessionCookie('tt_session=a%2Bb')).toBe('a+b')
    expect(readSessionCookie('tt_session=%E0%A4%A')).toBeUndefined()
  })
})
