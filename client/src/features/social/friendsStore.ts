// Friends + presence store (ClickUp subtask F).
//
// Deliberately separate from `gameStore`, for the same reason the auth store is:
// `gameStore` replaces its `state` wholesale on every `game_state` broadcast, and
// a friends list is account-scoped — it outlives any room and must not be
// clobbered when one ends.
//
// Note what this does NOT import: the auth store. Whether friends are usable is
// answered by the server (a `friend_list` that comes back rejected means "you're
// a guest"), not by reading a client-side session. That keeps the panel honest —
// the server is the only thing that actually knows — and keeps this ticket
// independent of subtask B's store landing.
import type { FriendSummary, User } from '@tuan-tanah/shared'
import { create } from 'zustand'
import i18n from '@/i18n/index.js'
import { renderErrorMessage } from '@/i18n/messages.js'
import { socket } from '@/socket.js'
import { playSound } from '@/sound/index.js'

/**
 * Turn a bare message code from an ack into the viewer's language, using the
 * same shared table the socket `error` event renders from. An unrecognised code
 * must never be shown raw, so the fallback is a generic sentence.
 */
function localize(code: string): string {
  return renderErrorMessage(i18n.t, { message: i18n.t('friends.error.generic'), code })
}

interface FriendsStore {
  friends: FriendSummary[]
  /** True while a `friend_list` is in flight. */
  loading: boolean
  /**
   * Whether this player can use friends at all: null until the first reply
   * lands, false for guests and when the server has no account storage.
   */
  available: boolean | null
  /** Localized rejection from the last action, shown inside the panel. */
  error: string | null
  /** Most recent incoming request, for the toast. */
  latestRequest: User | null

  init: () => void
  refresh: () => void
  /** Resolves true when the request was sent, so the caller can clear its input. */
  sendRequest: (friendCode: string) => Promise<boolean>
  respond: (userId: string, accept: boolean) => void
  remove: (userId: string) => void
  setBlocked: (userId: string, blocked: boolean) => void
  clearError: () => void
  dismissLatestRequest: () => void
}

// Socket listeners are global and must be attached exactly once, however many
// components call `init()`.
let wired = false

export const useFriends = create<FriendsStore>((set, get) => ({
  friends: [],
  loading: false,
  available: null,
  error: null,
  latestRequest: null,

  init: () => {
    if (!wired) {
      wired = true
      // The server pushes the whole list on every change — presence flips
      // included — so there is nothing to merge and no ordering to reconcile.
      socket.on('friends_updated', ({ friends }) =>
        set({ friends, available: true, loading: false }),
      )
      socket.on('friend_request_received', ({ from }) => {
        playSound('click')
        set({ latestRequest: from })
      })
      // A reconnect drops the presence room membership server-side, so re-ask
      // rather than sitting on a list that has stopped receiving pushes.
      socket.on('connect', () => get().refresh())
    }
    get().refresh()
  },

  refresh: () => {
    if (!socket.connected) return
    set({ loading: true })
    socket.emit('friend_list', (res) => {
      if (res.ok) {
        set({ friends: res.data.friends, available: true, loading: false })
        return
      }
      // A guest is not an error — it's the signed-out state the panel renders.
      const isGuest = res.error === 'core.requiresAccount'
      set({
        friends: [],
        available: false,
        loading: false,
        error: isGuest ? null : localize(res.error),
      })
    })
  },

  sendRequest: (friendCode) =>
    new Promise((resolve) => {
      set({ error: null })
      socket.emit('friend_request', { friendCode }, (res) => {
        if (res.ok) {
          playSound('click')
          resolve(true)
          return
        }
        set({ error: localize(res.error) })
        resolve(false)
      })
    }),

  respond: (userId, accept) => {
    set({ error: null })
    socket.emit('friend_respond', { userId, accept }, (res) => {
      if (!res.ok) set({ error: localize(res.error) })
      // Clear the toast once its request has been answered, wherever from.
      if (get().latestRequest?.id === userId) set({ latestRequest: null })
    })
  },

  remove: (userId) => {
    set({ error: null })
    socket.emit('friend_remove', { userId }, (res) => {
      if (!res.ok) set({ error: localize(res.error) })
    })
  },

  setBlocked: (userId, blocked) => {
    set({ error: null })
    socket.emit('friend_block', { userId, blocked }, (res) => {
      if (!res.ok) set({ error: localize(res.error) })
    })
  },

  clearError: () => set({ error: null }),
  dismissLatestRequest: () => set({ latestRequest: null }),
}))
