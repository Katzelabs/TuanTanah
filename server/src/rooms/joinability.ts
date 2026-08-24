// Can a new player still take a seat in this room, and if not, why?
//
// Split out of the join path because an invite needs the *reason*, not just a
// yes/no. A room invite is fire-and-forget — by the time the recipient taps
// Accept the room may have filled, started, or hit its TTL — and "room full"
// and "game already started" are different enough that telling a player the
// wrong one sends them chasing the wrong fix.
import { MAX_PLAYERS } from '@tuan-tanah/shared'
import type { GameStore } from './store.js'

/** Why a room can't be joined. `null` when it can. */
export type JoinBlocker = 'missing' | 'started' | 'full'

export interface Joinability {
  joinable: boolean
  reason: JoinBlocker | null
}

export async function roomJoinability(store: GameStore, roomId: string): Promise<Joinability> {
  const state = await store.get(roomId)
  if (!state) return { joinable: false, reason: 'missing' }
  if (state.phase !== 'lobby') return { joinable: false, reason: 'started' }
  if (state.players.length >= MAX_PLAYERS) return { joinable: false, reason: 'full' }
  return { joinable: true, reason: null }
}

/** The `invites.*` error code matching a blocker, for socket-side rejections. */
export const BLOCKER_ERROR_CODE: Record<JoinBlocker, string> = {
  missing: 'invites.roomGone',
  started: 'invites.roomStarted',
  full: 'invites.roomFull',
}
