// Presence: who is currently connected, and where.
//
// "Online" is defined as "has at least one live socket on this instance" — no
// heartbeat, no expiry, no extra state to go stale. A player with three tabs
// open is one online user with three sockets, and only the last one closing
// takes them offline.
//
// In-process, like the abuse counters in ../../security.ts, and with the same
// caveat: a horizontally-scaled deployment would have to move this into Redis
// (pub/sub for the transitions, a per-user socket count for the state) because
// each container would otherwise only see its own share of the connections.
import type { UserId } from '@tuan-tanah/shared'
import { getSession } from '../../rooms/sessions.js'

/** The socket.io room every one of a user's sockets joins. */
export function presenceRoom(userId: UserId): string {
  return `user:${userId}`
}

/** The minimum of a socket this module needs — keeps socket.io out of the type. */
export interface PresenceSocket {
  id: string
  join(room: string): void | Promise<void>
}

const socketsByUser = new Map<UserId, Set<string>>()
const userBySocket = new Map<string, UserId>()

/**
 * Register an authenticated socket and put it in the user's presence room.
 * Returns true when this is the user's FIRST live socket, i.e. they just came
 * online and their friends need telling.
 */
export async function attachPresence(socket: PresenceSocket, userId: UserId): Promise<boolean> {
  await socket.join(presenceRoom(userId))
  userBySocket.set(socket.id, userId)
  let sockets = socketsByUser.get(userId)
  if (!sockets) {
    sockets = new Set()
    socketsByUser.set(userId, sockets)
  }
  const wasOffline = sockets.size === 0
  sockets.add(socket.id)
  return wasOffline
}

/**
 * Drop a disconnected socket. Returns the user id only when that was their last
 * one — the caller uses it as "this user just went offline", so a player closing
 * one of several tabs produces no transition at all.
 */
export function detachPresence(socketId: string): UserId | null {
  const userId = userBySocket.get(socketId)
  if (!userId) return null
  userBySocket.delete(socketId)
  const sockets = socketsByUser.get(userId)
  if (!sockets) return null
  sockets.delete(socketId)
  if (sockets.size > 0) return null
  socketsByUser.delete(userId)
  return userId
}

export function isOnline(userId: UserId): boolean {
  return (socketsByUser.get(userId)?.size ?? 0) > 0
}

/** Only the online subset of `userIds` — one pass instead of N `isOnline` calls. */
export function onlineAmong(userIds: Iterable<UserId>): Set<UserId> {
  const out = new Set<UserId>()
  for (const id of userIds) if (isOnline(id)) out.add(id)
  return out
}

/**
 * The room one of the user's sockets is seated in, or null.
 *
 * Read straight off the live socket→seat map rather than cached, so it can't go
 * stale. The flip side is that it only refreshes when a friends list is built:
 * joining a room does not itself push an update to friends. Subtask G (room
 * invites) is the ticket that needs live room transitions, and owns adding them.
 */
export function currentRoomOf(userId: UserId): string | null {
  for (const socketId of socketsByUser.get(userId) ?? []) {
    const roomId = getSession(socketId)?.roomId
    if (roomId) return roomId
  }
  return null
}

/** Test seam — presence is module state, so a suite must be able to reset it. */
export function resetPresence(): void {
  socketsByUser.clear()
  userBySocket.clear()
}
