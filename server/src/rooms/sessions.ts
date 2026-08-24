// Maps a live socket connection to its room + player identity.
import type { UserId } from '@tuan-tanah/shared'

export interface Session {
  roomId: string
  playerId: string
  /**
   * The signed-in account behind this socket, when there is one. Populated by
   * subtask A's auth middleware and absent for guests — which stays the normal
   * case, so nothing here may depend on it. Read at game-over to attribute an
   * archived result to an account (subtask E).
   */
  userId?: UserId
}

const sessions = new Map<string, Session>()

export function setSession(socketId: string, session: Session): void {
  sessions.set(socketId, session)
}

export function getSession(socketId: string): Session | undefined {
  return sessions.get(socketId)
}

export function clearSession(socketId: string): void {
  sessions.delete(socketId)
}
