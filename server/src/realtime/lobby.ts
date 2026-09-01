import { randomUUID } from 'node:crypto'
import {
  addPlayer,
  forfeit,
  pickRole,
  removePlayer,
  setConnected,
  startGame,
  sweepExpiredGrace,
  updateSettings,
} from '../engine/index.js'
import { createRoom, mutateRoom } from '../rooms/rooms.js'
import { clearSession, setSession } from '../rooms/sessions.js'
import type { GameStore } from '../rooms/store.js'
import { broadcastAndArm } from './afk.js'
import {
  armDisconnectGrace,
  clearDisconnectGrace,
  clearRoomGraceTimers,
  deleteRoom,
} from './presence.js'
import {
  broadcastState,
  guard,
  requireSession,
  sendStateTo,
  type TTServer,
  type TTSocket,
} from './common.js'
import { concludeIfWon, scheduleTimeLimit } from './gameOver.js'

export function registerLobbyHandlers(io: TTServer, socket: TTSocket, store: GameStore): void {
  socket.on('join_room', async (payload, ack) => {
    try {
      const requested = payload.roomId?.trim().toUpperCase()
      let roomId = requested
      if (!roomId) {
        const room = await createRoom(store)
        roomId = room.roomId
      } else if (!(await store.has(roomId))) {
        ack?.({ ok: false, error: 'Room not found' })
        return
      }

      const { player, token } = await mutateRoom(store, roomId, (state) => {
        // Timers are in-process, so a restart can leave expired seats still
        // sitting there. Clear them before counting the room as full.
        sweepExpiredGrace(state)
        const player = addPlayer(state, payload.playerName)
        const token = randomUUID()
        state.reconnectTokens ??= {}
        state.reconnectTokens[player.id] = token
        return { player, token }
      })

      // `socket.data.userId` is set at handshake by the auth middleware and is
      // undefined for guests — seats never depend on it.
      setSession(socket.id, { roomId, playerId: player.id, userId: socket.data.userId })
      await socket.join(roomId)
      ack?.({ ok: true, data: { roomId, playerId: player.id, token } })
      socket.emit('room_joined', { roomId, playerId: player.id })
      await broadcastState(io, store, roomId)
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message ?? 'Could not join room' })
    }
  })

  socket.on('rejoin', async (payload, ack) => {
    try {
      const roomId = payload.roomId?.trim().toUpperCase()
      if (!roomId || !(await store.has(roomId))) {
        ack?.({ ok: false, error: 'Room not found', reason: 'room_gone' })
        return
      }

      const found = await mutateRoom(store, roomId, (state) => {
        // Same lazy sweep as join_room: if this seat's own grace ran out while the
        // server was down, it expires here rather than being silently revived.
        sweepExpiredGrace(state)
        if (!state.players.some((p) => p.id === payload.playerId)) return false
        // Require the secret token — a known playerId alone (it's broadcast to
        // every client) must not be enough to reclaim a seat.
        if (state.reconnectTokens?.[payload.playerId] !== payload.token) return false
        setConnected(state, payload.playerId, true)
        return true
      })
      if (!found) {
        // The seat is unrecoverable, not merely unreachable — tell the client so,
        // so it drops the saved session instead of retrying forever.
        ack?.({ ok: false, error: 'Could not restore session', reason: 'seat_gone' })
        return
      }

      // Back inside the window: cancel the pending expiry for this seat.
      clearDisconnectGrace(roomId, payload.playerId)
      setSession(socket.id, { roomId, playerId: payload.playerId, userId: socket.data.userId })
      await socket.join(roomId)
      ack?.({ ok: true, data: { roomId, playerId: payload.playerId, token: payload.token } })
      socket.emit('room_joined', { roomId, playerId: payload.playerId })
      await broadcastState(io, store, roomId)
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message ?? 'Could not rejoin' })
    }
  })

  // Resync on demand (e.g. a tab returning from the background). Read-only: just
  // re-send the caller the canonical state — no mutation, and only to this socket.
  socket.on('request_state', () =>
    guard(socket, async () => {
      const { roomId } = requireSession(socket)
      await sendStateTo(socket, store, roomId)
    }),
  )

  socket.on('pick_role', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => pickRole(state, playerId, payload.role))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('update_settings', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => updateSettings(state, playerId, payload.settings))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('start_game', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => {
        sweepExpiredGrace(state)
        startGame(state, playerId)
      })
      // `startGame` drops any seat still disconnected, and everyone left is
      // present — so no grace countdown from the lobby should outlive the whistle.
      clearRoomGraceTimers(roomId)
      await scheduleTimeLimit(io, store, roomId)
      // Arm the AFK clock for the first turn (also broadcasts the fresh deadline).
      await broadcastAndArm(io, store, roomId)
    }),
  )

  socket.on('leave_room', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // Lobby leave removes the seat; leaving a live game forfeits (eliminates)
      // so the rest can keep playing. Once the game has ended there's nothing to
      // forfeit — just release the seat's token.
      const { wasPlaying, empty } = await mutateRoom(store, roomId, (state) => {
        const playing = state.phase === 'playing'
        if (state.phase === 'lobby') removePlayer(state, playerId)
        else if (playing) forfeit(state, playerId)
        if (state.reconnectTokens) delete state.reconnectTokens[playerId]
        return { wasPlaying: playing, empty: state.players.length === 0 }
      })
      clearDisconnectGrace(roomId, playerId)
      clearSession(socket.id)
      await socket.leave(roomId)
      // Last one out: drop the room instead of leaving an empty lobby (and its
      // timers) alive until the TTL.
      if (empty) {
        await deleteRoom(store, roomId)
        return
      }
      await broadcastAndArm(io, store, roomId)
      if (wasPlaying) {
        io.to(roomId).emit('player_eliminated', { playerId })
        await concludeIfWon(io, store, roomId)
      }
    }),
  )

  socket.on('surrender', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // Give up while the game is live: forfeit (eliminate) so the rest can keep
      // playing, but — unlike leave_room — keep the session and seat token so the
      // surrendered player stays connected and watches as a spectator.
      const forfeited = await mutateRoom(store, roomId, (state) => {
        if (state.phase !== 'playing') return false
        forfeit(state, playerId)
        return true
      })
      await broadcastAndArm(io, store, roomId)
      if (forfeited) {
        io.to(roomId).emit('player_eliminated', { playerId })
        await concludeIfWon(io, store, roomId)
      }
    }),
  )

  socket.on('disconnect', () => {
    void guard(socket, async () => {
      const session = getSessionSafe(socket)
      if (!session) return
      const { roomId, playerId } = session
      // The seat is kept, not released: the player has DISCONNECT_GRACE_MS to come
      // back to it. Only when that runs out does `presence.ts` act on the absence.
      const marked = await mutateRoom(store, roomId, (state) => {
        setConnected(state, playerId, false)
        return true
      }).catch(() => false)
      clearSession(socket.id)
      // Don't arm a countdown against a room we couldn't even write to (gone, or
      // mid-failure) — it would only fire into nothing 45s later.
      if (marked) armDisconnectGrace(io, store, roomId, playerId)
      await broadcastState(io, store, roomId)
    })
  })
}

function getSessionSafe(socket: TTSocket) {
  try {
    return requireSession(socket)
  } catch {
    return undefined
  }
}
