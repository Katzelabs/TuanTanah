import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@tuan-tanah/shared'
import type { GameStore } from '../rooms/store.js'
import { isDev } from '../bootstrap/env.js'
import { EngineError } from '../engine/index.js'
import { reportError } from '../observability/report.js'
import { getSession } from '../rooms/sessions.js'

export type TTServer = Server<ClientToServerEvents, ServerToClientEvents>
export type TTSocket = Socket<ClientToServerEvents, ServerToClientEvents>

/** Broadcast the canonical game state to everyone in a room. */
export async function broadcastState(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  const state = await store.get(roomId)
  if (!state) return
  // Strip server-only reconnect tokens — they must never reach any client, or a
  // player could replay another's token to hijack their seat.
  const { reconnectTokens: _tokens, ...safe } = state
  io.to(roomId).emit('game_state', safe)
}

/** Send the canonical game state to a single socket (e.g. a resync request). */
export async function sendStateTo(
  socket: TTSocket,
  store: GameStore,
  roomId: string,
): Promise<void> {
  const state = await store.get(roomId)
  if (!state) return
  // Same token-stripping invariant as broadcastState — never leak reconnect tokens.
  const { reconnectTokens: _tokens, ...safe } = state
  socket.emit('game_state', safe)
}

/**
 * Run an async handler body, turning thrown errors into a socket `error` event —
 * and splitting the two very different things that can be thrown.
 *
 * An `EngineError` is the engine saying NO to a player: not your turn, not enough
 * cash, tile already owned. It is expected control flow, it happens constantly,
 * and it is nobody's problem but that player's.
 *
 * Anything else is a fault. Until this split existed the two were indistinguishable
 * — a `TypeError` in a handler was emitted to one player as a toast and then gone,
 * with nothing written server-side, which is why a bug here could run for weeks
 * unnoticed.
 */
export async function guard(socket: TTSocket, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof EngineError) {
      socket.emit('error', { message: err.message, code: err.code, params: err.params })
      return
    }

    const session = getSession(socket.id)
    reportError(err, {
      at: 'socket-handler',
      socketId: socket.id,
      roomId: session?.roomId,
      playerId: session?.playerId,
    })

    // Don't hand internal failure text to a client — it can carry connection
    // strings and query fragments. Send a localisable generic code instead, and
    // keep the raw message in dev, where it is the fastest way to see the bug.
    socket.emit('error', {
      message: isDev ? ((err as Error)?.message ?? 'Unexpected error') : 'Unexpected error',
      code: 'core.unexpected',
    })
  }
}

/**
 * Resolve the player's session or reject the action. An `EngineError`, not a bare
 * one: a socket acting without a session is a stale or reconnecting client, not a
 * bug, so it must stay out of the fault stream — and this way it is localised like
 * every other rejection instead of being one of the last English-only strings.
 */
export function requireSession(socket: TTSocket) {
  const session = getSession(socket.id)
  if (!session) throw new EngineError('core.notInRoom')
  return session
}
