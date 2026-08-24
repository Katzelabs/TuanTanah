// Read-only HTTP routes about rooms.
//
// Exists for the invite-accept path (ClickUp subtask G): `join_room`'s ack
// carries a plain string, so a failed join can't tell the client *which* of
// "room full" / "already started" / "no longer exists" happened in a form it
// can localize. This does, without widening the socket contract.
import type { FastifyInstance } from 'fastify'
import { roomJoinability } from './joinability.js'
import type { GameStore } from './store.js'

export function registerRoomRoutes(app: FastifyInstance, store: GameStore): void {
  // Public on purpose: it reveals only whether a room code is currently
  // joinable, which anyone holding the code learns by trying to join anyway.
  app.get<{ Params: { roomId: string } }>('/api/rooms/:roomId/joinable', async (request) => {
    const roomId = request.params.roomId.trim().toUpperCase()
    return roomJoinability(store, roomId)
  })
}
