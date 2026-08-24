// Ask the server whether a room can still be joined, and why not.
//
// Backs the invite-accept path: an invite is fire-and-forget, so by the time it
// is tapped the room may have filled, started, or expired — and those need to
// read as three different messages, not one "couldn't join".
export type JoinBlocker = 'missing' | 'started' | 'full'

export interface Joinability {
  joinable: boolean
  reason: JoinBlocker | null
}

const BLOCKERS: readonly JoinBlocker[] = ['missing', 'started', 'full']

const apiBase = import.meta.env.VITE_SERVER_URL || ''

export async function roomJoinability(roomId: string): Promise<Joinability> {
  try {
    const res = await fetch(`${apiBase}/api/rooms/${encodeURIComponent(roomId)}/joinable`)
    if (!res.ok) return { joinable: false, reason: 'missing' }
    const body: unknown = await res.json()
    return parseJoinability(body)
  } catch {
    // The network, not the room. Let the join attempt itself decide rather than
    // blaming the room for something it didn't do.
    return { joinable: true, reason: null }
  }
}

export function parseJoinability(body: unknown): Joinability {
  const raw = body as Partial<Joinability> | null
  if (!raw || typeof raw.joinable !== 'boolean') return { joinable: false, reason: 'missing' }
  const reason = BLOCKERS.find((b) => b === raw.reason) ?? null
  return { joinable: raw.joinable, reason: raw.joinable ? null : (reason ?? 'missing') }
}
