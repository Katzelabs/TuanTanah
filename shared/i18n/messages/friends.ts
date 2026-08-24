// Friends / presence (ClickUp subtask F of the player-accounts epic). Errors
// only: friend actions are account-level, not game events, so none of them ever
// land in `state.log`.
//
// These codes travel two ways. `friend_*` events answer through their ack
// envelope (`AckResult.error` carries the bare code), and the guest rejection
// also goes out as a socket `error`. Both ends render from this one table, so a
// friends failure is localized exactly like an EngineError.
import type { MessageMap } from '../params.js'

export const log: MessageMap = { en: {}, id: {} }

export const error: MessageMap = {
  en: {
    'friends.unavailable': 'Friends are unavailable right now',
    'friends.codeInvalid': "That friend code doesn't look right",
    'friends.codeNotFound': 'No player has that friend code',
    'friends.self': "That's your own friend code",
    'friends.alreadyFriends': 'You are already friends',
    'friends.requestPending': 'There is already a pending request with that player',
    // Deliberately vague: it must not reveal WHO blocked whom, or that a block
    // exists at all rather than the account simply being unreachable.
    'friends.blocked': 'That player cannot be added',
    'friends.tooManyPending': 'You have too many pending requests — cancel one first',
    'friends.notFound': 'That request is no longer available',
    'friends.unexpected': 'Something went wrong — please try again',
  },
  id: {
    'friends.unavailable': 'Fitur teman sedang tidak tersedia',
    'friends.codeInvalid': 'Kode teman itu tidak valid',
    'friends.codeNotFound': 'Tidak ada pemain dengan kode teman itu',
    'friends.self': 'Itu kode teman kamu sendiri',
    'friends.alreadyFriends': 'Kalian sudah berteman',
    'friends.requestPending': 'Sudah ada permintaan yang tertunda dengan pemain itu',
    'friends.blocked': 'Pemain itu tidak bisa ditambahkan',
    'friends.tooManyPending': 'Permintaan tertunda kamu terlalu banyak — batalkan salah satu dulu',
    'friends.notFound': 'Permintaan itu sudah tidak tersedia',
    'friends.unexpected': 'Terjadi kesalahan — coba lagi',
  },
}
