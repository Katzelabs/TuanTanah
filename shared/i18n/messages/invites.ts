// Server-emitted messages for room invites (ClickUp subtask G, `realtime/invites.ts`).
// Codes are namespaced `invites.*` so they can't collide with the friends layer
// (subtask F) landing in parallel.
import type { MessageMap } from '../params.js'

// Invites produce no game-log entries — they happen outside the room the
// recipient is in, and the lobby has nothing to narrate. Kept for the module
// shape the messages index merges over.
export const log: MessageMap = { en: {}, id: {} }

export const error: MessageMap = {
  en: {
    'invites.disabled': 'Accounts are not enabled on this server',
    'invites.requiresAccount': 'Sign in to invite friends',
    'invites.self': "You can't invite yourself",
    'invites.notFriends': 'You can only invite friends you have added',
    'invites.offline': '{{name}} is offline — send them the room link instead',
    'invites.tooMany': 'You have already invited {{name}} to this room',
    'invites.roomGone': 'That room no longer exists',
    'invites.roomStarted': 'That game has already started',
    'invites.roomFull': 'That room is full',
  },
  id: {
    'invites.disabled': 'Akun tidak diaktifkan di server ini',
    'invites.requiresAccount': 'Masuk dulu untuk mengundang teman',
    'invites.self': 'Anda tidak bisa mengundang diri sendiri',
    'invites.notFriends': 'Anda hanya bisa mengundang teman yang sudah ditambahkan',
    'invites.offline': '{{name}} sedang offline — kirimkan tautan ruangan saja',
    'invites.tooMany': 'Anda sudah mengundang {{name}} ke ruangan ini',
    'invites.roomGone': 'Ruangan itu sudah tidak ada',
    'invites.roomStarted': 'Permainan itu sudah dimulai',
    'invites.roomFull': 'Ruangan itu penuh',
  },
}
