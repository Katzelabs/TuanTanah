// Socket handlers for the friends feature (ClickUp subtask F).
//
// Two things happen here. Every authenticated socket joins its owner's presence
// room, so a change to one player's friends list can be pushed to every tab that
// player has open; and the five `friend_*` events from the shared contract are
// answered through their ack envelope.
//
// Unlike the game handlers these do NOT go through `mutateRoom` — friendships
// aren't room state, they're rows in Postgres, and none of them touch a
// `GameState`.
import type { AckResult, FriendSummary, UserId } from '@tuan-tanah/shared'
import { renderErrorEn } from '../engine/messages.js'
import { reportError } from '../observability/report.js'
import {
  acceptedFriendIds,
  attachPresence,
  detachPresence,
  FriendsError,
  listFriends,
  presenceRoom,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
  setBlocked,
} from '../modules/social/index.js'
import type { TTServer, TTSocket } from './common.js'

/**
 * The account behind this socket, or null for a guest.
 *
 * Subtask A's `io.use()` middleware reads the session cookie and attaches the
 * account id here (see `modules/auth/README.md`); until it lands, every socket
 * reads as a guest and the friends UI shows its signed-out state. That is the
 * whole coupling between the two tickets — nothing in this file imports A's
 * still-unimplemented functions, so F builds and runs on its own.
 */
export function socketUserId(socket: TTSocket): UserId | null {
  const userId = (socket.data as { userId?: unknown })?.userId
  return typeof userId === 'string' && userId.length > 0 ? userId : null
}

function requireUser(socket: TTSocket): UserId {
  const userId = socketUserId(socket)
  if (!userId) throw new FriendsError('core.requiresAccount')
  return userId
}

/** Push a user their current list, if they have any socket to receive it. */
async function pushFriends(io: TTServer, userId: UserId): Promise<void> {
  const friends = await listFriends(userId)
  io.to(presenceRoom(userId)).emit('friends_updated', { friends })
}

/**
 * Re-send the list to both sides of a pair after a change. The other player sees
 * the new state without asking, which is what makes an accepted request appear
 * instantly on the requester's screen.
 */
async function pushBoth(io: TTServer, a: UserId, b: UserId): Promise<void> {
  await Promise.all([pushFriends(io, a), pushFriends(io, b)])
}

/**
 * Tell a user's accepted friends that their presence changed. Only the ones who
 * are themselves online are pushed to — an offline friend has nothing listening,
 * and will build a fresh list with correct presence when they next connect.
 */
async function announcePresence(io: TTServer, userId: UserId): Promise<void> {
  const friendIds = await acceptedFriendIds(userId)
  await Promise.all(friendIds.map((id) => pushFriends(io, id)))
}

/**
 * Run a friend action and answer its ack.
 *
 * A `FriendsError` is the friends equivalent of an `EngineError`: a rejected
 * action, carried back as a bare message code the client localizes from the same
 * shared table the socket `error` event uses. Anything else is a bug — reported
 * with context, and answered with a generic code so internal failure text never
 * reaches a client.
 */
async function withAck<T>(
  socket: TTSocket,
  ack: ((res: AckResult<T>) => void) | undefined,
  fn: (userId: UserId) => Promise<T>,
  { announceGuest = true }: { announceGuest?: boolean } = {},
): Promise<void> {
  try {
    ack?.({ ok: true, data: await fn(requireUser(socket)) })
  } catch (err) {
    if (err instanceof FriendsError) {
      // The guest rejection also goes out as a socket `error`, as the events
      // contract specifies, so it surfaces in the normal toast rather than only
      // inside whichever panel happened to make the call. Ordinary friend
      // rejections don't: the panel that asked is the right place to show them,
      // and a second global toast would just double up.
      if (announceGuest && err.code === 'core.requiresAccount') {
        socket.emit('error', { message: renderErrorEn(err.code), code: err.code })
      }
      ack?.({ ok: false, error: err.code })
      return
    }
    reportError(err, { at: 'friends-handler', socketId: socket.id })
    ack?.({ ok: false, error: 'friends.unexpected' })
  }
}

export function registerFriendHandlers(io: TTServer, socket: TTSocket): void {
  const connectedAs = socketUserId(socket)
  if (connectedAs) {
    void (async () => {
      try {
        const cameOnline = await attachPresence(socket, connectedAs)
        await pushFriends(io, connectedAs)
        if (cameOnline) await announcePresence(io, connectedAs)
      } catch (err) {
        reportError(err, { at: 'friends-presence-connect', socketId: socket.id })
      }
    })()
  }

  socket.on('friend_request', (payload, ack) =>
    withAck<null>(socket, ack, async (userId) => {
      const { target, autoAccepted } = await sendFriendRequest(userId, payload.friendCode)
      await pushBoth(io, userId, target.id)
      if (!autoAccepted) {
        // The requester's own account, as the target will see it in their list.
        const [self] = (await listFriends(target.id)).filter((f) => f.user.id === userId)
        if (self)
          io.to(presenceRoom(target.id)).emit('friend_request_received', { from: self.user })
      }
      return null
    }),
  )

  socket.on('friend_respond', (payload, ack) =>
    withAck<null>(socket, ack, async (userId) => {
      await respondToRequest(userId, payload.userId, payload.accept)
      await pushBoth(io, userId, payload.userId)
      return null
    }),
  )

  socket.on('friend_remove', (payload, ack) =>
    withAck<null>(socket, ack, async (userId) => {
      await removeFriend(userId, payload.userId)
      await pushBoth(io, userId, payload.userId)
      return null
    }),
  )

  socket.on('friend_block', (payload, ack) =>
    withAck<null>(socket, ack, async (userId) => {
      await setBlocked(userId, payload.userId, payload.blocked)
      await pushBoth(io, userId, payload.userId)
      return null
    }),
  )

  // Read-only subscribe, and the one friend event the client fires without the
  // player asking for it (to populate the pending-requests badge). Silent for
  // guests, or every guest landing on the home page would be toasted at.
  socket.on('friend_list', (ack) =>
    withAck<{ friends: FriendSummary[] }>(
      socket,
      ack,
      async (userId) => ({ friends: await listFriends(userId) }),
      { announceGuest: false },
    ),
  )

  socket.on('disconnect', () => {
    // Non-null only when that was the user's LAST socket, so closing one of
    // several tabs doesn't flicker them offline for everyone.
    const wentOffline = detachPresence(socket.id)
    if (!wentOffline) return
    void announcePresence(io, wentOffline).catch((err) =>
      reportError(err, { at: 'friends-presence-disconnect', socketId: socket.id }),
    )
  })
}
