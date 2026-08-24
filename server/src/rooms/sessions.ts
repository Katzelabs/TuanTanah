// Maps a live socket connection to its room + player identity.
import type { UserId } from '@tuan-tanah/shared'

export interface Session {
  roomId: string
  playerId: string
  /**
   * The signed-in account behind this seat, when there is one. Absent for guests,
   * which stays the norm — seat reclaim runs on `reconnectTokens`, not on this,
   * so an account is extra information about a player and never a requirement.
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
