// The two account mutations (ClickUp 86ey2z15r). Reading the account is the auth
// store's job (`GET /api/auth/me`); this only writes.
//
// The server answers with a stable `error` code rather than prose so the message
// can be rendered in the viewer's language, the same split the engine uses for
// its own errors. Every failure is mapped to one of those codes — a caller never
// has to deal with a thrown fetch.
import type { AuthUser } from '@tuan-tanah/shared'

export type AccountErrorCode =
  | 'unauthenticated'
  | 'invalid_name'
  | 'not_found'
  | 'unavailable'
  | 'network'

const CODES: readonly string[] = ['unauthenticated', 'invalid_name', 'not_found', 'unavailable']

export type AccountResult<T> = { ok: true; value: T } | { ok: false; error: AccountErrorCode }

/** Trust only codes we know; anything else (a proxy's HTML 502) is 'unavailable'. */
async function errorFrom(response: Response): Promise<AccountErrorCode> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string' && CODES.includes(body.error)) {
      return body.error as AccountErrorCode
    }
  } catch {
    // Not JSON — fall through to the generic code below.
  }
  return response.status === 401 ? 'unauthenticated' : 'unavailable'
}

export async function updateDisplayName(displayName: string): Promise<AccountResult<AuthUser>> {
  let response: Response
  try {
    response = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName }),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  if (!response.ok) return { ok: false, error: await errorFrom(response) }
  const body = (await response.json()) as { user: AuthUser }
  return { ok: true, value: body.user }
}

export async function deleteAccount(): Promise<AccountResult<null>> {
  let response: Response
  try {
    response = await fetch('/api/account', { method: 'DELETE' })
  } catch {
    return { ok: false, error: 'network' }
  }
  if (!response.ok) return { ok: false, error: await errorFrom(response) }
  return { ok: true, value: null }
}
