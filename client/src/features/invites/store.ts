// Room invites (ClickUp subtask G): sending one from the lobby, and receiving
// one anywhere in the app.
//
// A store of its own rather than more surface on `gameStore`, for the same
// reason `features/auth` is separate: an invite arrives while you're in some
// *other* room, and `gameStore` replaces its `state` wholesale on every
// `game_state` broadcast. Invites also outlive leaving a room.
import type { FriendSummary, RoomInvite, UserId } from '@tuan-tanah/shared'
import { create } from 'zustand'
import { socket } from '@/socket.js'
import { useGame } from '@/store/gameStore.js'
import { type JoinBlocker, roomJoinability } from './joinability.js'

/**
 * How long a received invite stays actionable. Nothing server-side expires it —
 * the room does (fill, start, TTL) — so this is only about not leaving a stale
 * prompt on screen; the real check happens again on Accept.
 */
export const INVITE_TTL_MS = 5 * 60 * 1000

/** Friends the server can't tell us about yet don't block the rest of the lobby. */
const FRIEND_LIST_TIMEOUT_MS = 5000

interface InviteState {
  /** The invite currently being offered to this player, if any. */
  incoming: RoomInvite | null
  /** Why accepting failed, as a `JoinBlocker` the UI localizes. */
  blocker: JoinBlocker | null
  accepting: boolean

  friends: FriendSummary[]
  friendsLoading: boolean
  /** True for guests, and until subtask F's `friend_list` handler exists. */
  friendsUnavailable: boolean
  /** Who we're mid-invite to, and who we've already invited this session. */
  sending: UserId | null
  invited: UserId[]

  init: () => void
  loadFriends: () => void
  invite: (userId: UserId) => void
  dismiss: () => void
  accept: (displayName: string, onJoined: (roomId: string) => void) => Promise<void>
}

let listenersWired = false
let expiryTimer: ReturnType<typeof setTimeout> | undefined

export const useInvites = create<InviteState>((set, get) => ({
  incoming: null,
  blocker: null,
  accepting: false,
  friends: [],
  friendsLoading: false,
  friendsUnavailable: false,
  sending: null,
  invited: [],

  init: () => {
    if (listenersWired) return
    listenersWired = true

    socket.on('room_invite', (invite) => {
      // Already sitting in that room — the invite raced our own join, and
      // prompting someone to join where they are is just noise. The server
      // can't filter this: it knows accounts, not who holds which seat.
      if (useGame.getState().roomId === invite.roomId) return
      // Latest invite wins — two friends inviting you at once should not stack
      // prompts on top of each other.
      set({ incoming: invite, blocker: null, accepting: false })
      clearTimeout(expiryTimer)
      const age = Date.now() - Date.parse(invite.sentAt)
      const left = INVITE_TTL_MS - (Number.isFinite(age) ? age : 0)
      expiryTimer = setTimeout(() => set({ incoming: null }), Math.max(0, left))
    })

    // The friends list is what the invite picker renders, so keep it live:
    // presence flips as friends come and go, and "online first" is the whole
    // point of the ordering.
    socket.on('friends_updated', ({ friends }) =>
      set({ friends, friendsLoading: false, friendsUnavailable: false }),
    )
  },

  loadFriends: () => {
    if (get().friendsLoading) return
    set({ friendsLoading: true })
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      set({ friendsLoading: false, friendsUnavailable: true })
    }, FRIEND_LIST_TIMEOUT_MS)

    socket.emit('friend_list', (res) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (res.ok)
        set({ friends: res.data.friends, friendsLoading: false, friendsUnavailable: false })
      else set({ friendsLoading: false, friendsUnavailable: true })
    })
  },

  invite: (userId) => {
    if (get().sending) return
    set({ sending: userId })
    socket.emit('invite_to_room', { userId }, (res) => {
      // A rejection already reached the player as a localized `error` toast
      // (the server sends both), so there's nothing to render here — just stop
      // claiming the invite is in flight, and only mark it sent if it was.
      set({
        sending: null,
        invited: res.ok ? [...get().invited, userId] : get().invited,
      })
    })
  },

  dismiss: () => {
    clearTimeout(expiryTimer)
    set({ incoming: null, blocker: null, accepting: false })
  },

  accept: async (displayName, onJoined) => {
    const invite = get().incoming
    if (!invite || get().accepting) return
    set({ accepting: true, blocker: null })

    // Ask why *before* joining: `join_room`'s ack is a plain string, so a failed
    // join can't say which of full / started / gone happened in a localizable
    // form. Between this check and the join the room could still change, but
    // then the generic join error is the honest answer.
    const { joinable, reason } = await roomJoinability(invite.roomId)
    if (!joinable) {
      set({ accepting: false, blocker: reason ?? 'missing' })
      return
    }

    const game = useGame.getState()
    // One tap means one tap: if we're sitting in another room, leave it rather
    // than making the player back out first.
    if (game.roomId && game.roomId !== invite.roomId) game.leave()

    // `join` only calls back on success; watch `joining` so a rejected join
    // still releases the button instead of spinning forever.
    const unsubscribe = useGame.subscribe((s) => {
      if (s.joining) return
      unsubscribe()
      set({ accepting: false })
    })

    game.join(displayName, invite.roomId, (roomId) => {
      clearTimeout(expiryTimer)
      set({ incoming: null, blocker: null, accepting: false })
      onJoined(roomId)
    })
  },
}))
