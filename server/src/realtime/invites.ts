// Room invites (ClickUp subtask G): a signed-in player invites an accepted
// friend straight into the room they're sitting in, so the friend never has to
// be told a room code.
//
// Delivery is by *presence room*, not by socket id: the recipient may have the
// game open in several tabs and may be anywhere in the app, so the invite goes
// to every socket authenticated as that account. `user:<userId>` is the room
// naming the epic agreed on (see the `room_invite` declaration in
// shared/types/events.ts and subtask F's presence layer).
import type { AuthUser, RoomInvite, User, UserId } from '@tuan-tanah/shared'
import { EngineError } from '../engine/index.js'
import { authEnabled, getUser, resolveSession } from '../modules/invites/authBridge.js'
import { claimInviteBudget, inviteRelation } from '../modules/invites/index.js'
import { reportError } from '../observability/report.js'
import { BLOCKER_ERROR_CODE, roomJoinability } from '../rooms/joinability.js'
import type { GameStore } from '../rooms/store.js'
import { guard, requireSession, type TTServer, type TTSocket } from './common.js'

/**
 * Name of the opaque session cookie subtask A issues. Kept as one constant so
 * reconciling it with A's is a one-line merge rather than a hunt.
 */
const SESSION_COOKIE = 'tt_session'

/** The Socket.io room every socket authenticated as `userId` joins. */
export const presenceRoom = (userId: UserId): string => `user:${userId}`

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() !== name) continue
    return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

/** The account behind this socket, or null when the caller is a guest. */
async function socketUser(socket: TTSocket): Promise<UserId | null> {
  if (!authEnabled()) return null
  const cookie = socket.handshake.headers.cookie
  const session = await resolveSession(readCookie(cookie, SESSION_COOKIE))
  return session?.userId ?? null
}

/** Drop the private fields — `RoomInvite.from` is broadcast-safe `User`. */
function publicUser(user: AuthUser): User {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    friendCode: user.friendCode,
    createdAt: user.createdAt,
  }
}

export function registerInviteHandlers(io: TTServer, socket: TTSocket, store: GameStore): void {
  // Subscribe this connection to its account's presence room, so invites reach
  // it wherever in the app the player happens to be. Guests simply never join.
  void socketUser(socket)
    .then((userId) => {
      if (userId && socket.connected) return socket.join(presenceRoom(userId))
    })
    // A session lookup that blows up would otherwise leave this account
    // unreachable by invites with nothing written down anywhere.
    .catch((err) => reportError(err, { at: 'invite-presence-join', socketId: socket.id }))

  socket.on('invite_to_room', (payload, ack) =>
    guard(socket, async () => {
      try {
        await sendInvite(io, socket, store, payload.userId)
        ack?.({ ok: true, data: null })
      } catch (err) {
        // Answer the ack as well as rethrowing: the ack settles the sender's
        // button state, and `guard` turns an EngineError into the localized
        // `error` event every other rejected action already surfaces.
        ack?.({ ok: false, error: (err as Error).message })
        throw err
      }
    }),
  )
}

async function sendInvite(
  io: TTServer,
  socket: TTSocket,
  store: GameStore,
  targetId: UserId,
): Promise<void> {
  if (!authEnabled()) throw new EngineError('invites.disabled')

  const fromUserId = await socketUser(socket)
  if (!fromUserId) throw new EngineError('invites.requiresAccount')
  if (fromUserId === targetId) throw new EngineError('invites.self')

  // The room the inviter is actually seated in — never a room id from the
  // client, which would let anyone spam invites into rooms they aren't in.
  const { roomId } = requireSession(socket)

  const relation = await inviteRelation(fromUserId, targetId)
  // A block is silent on purpose. Telling the sender "you are blocked" turns
  // the block into a notification and hands them a probe for it; from their
  // side an ignored invite is indistinguishable from one that was declined.
  if (relation === 'blocked') return
  if (relation !== 'accepted') throw new EngineError('invites.notFriends')

  const target = await getUser(targetId)
  if (!target) throw new EngineError('invites.notFriends')

  const { reason } = await roomJoinability(store, roomId)
  if (reason) throw new EngineError(BLOCKER_ERROR_CODE[reason])

  const sockets = await io.in(presenceRoom(targetId)).fetchSockets()
  if (sockets.length === 0) {
    // This epic deliberately has no email or push provider, so an offline
    // friend can't be reached — say so instead of silently dropping it, and
    // let the sender fall back to the share link.
    throw new EngineError('invites.offline', { name: target.displayName })
  }

  if (!claimInviteBudget(roomId, targetId)) {
    throw new EngineError('invites.tooMany', { name: target.displayName })
  }

  const inviter = await getUser(fromUserId)
  if (!inviter) throw new EngineError('invites.requiresAccount')

  const invite: RoomInvite = {
    roomId,
    from: publicUser(inviter),
    sentAt: new Date().toISOString(),
  }
  io.to(presenceRoom(targetId)).emit('room_invite', invite)
}
