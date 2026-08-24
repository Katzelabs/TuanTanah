import { describe, expect, it, beforeEach } from 'vitest'
import {
  asFriendshipStatus,
  canonicalPair,
  directionFor,
  isVisibleTo,
  normalizeFriendCode,
  otherUserId,
} from '../src/modules/social/pairs.js'
import {
  attachPresence,
  currentRoomOf,
  detachPresence,
  isOnline,
  onlineAmong,
  presenceRoom,
  resetPresence,
} from '../src/modules/social/presence.js'
import { clearSession, setSession } from '../src/rooms/sessions.js'

const ALICE = 'aaaaaaaa-0000-0000-0000-000000000001'
const BOB = 'bbbbbbbb-0000-0000-0000-000000000002'

describe('normalizeFriendCode', () => {
  it('uppercases and strips separators players type from a screenshot', () => {
    expect(normalizeFriendCode('ab12-cd34')).toBe('AB12CD34')
    expect(normalizeFriendCode('  ab 12 cd 34 ')).toBe('AB12CD34')
  })

  it('rejects codes that are empty, too short, too long, or non-alphanumeric', () => {
    expect(normalizeFriendCode('')).toBeNull()
    expect(normalizeFriendCode('---')).toBeNull()
    expect(normalizeFriendCode('AB1')).toBeNull()
    expect(normalizeFriendCode('A'.repeat(17))).toBeNull()
  })
})

describe('canonicalPair', () => {
  it('orders a pair the same way whichever side asks', () => {
    expect(canonicalPair(ALICE, BOB)).toEqual(canonicalPair(BOB, ALICE))
    expect(canonicalPair(BOB, ALICE)).toEqual([ALICE, BOB])
  })
})

describe('reading a row from one side', () => {
  const outgoing = { requester_id: ALICE, addressee_id: BOB, status: 'pending' }

  it('resolves the other player from either side', () => {
    expect(otherUserId(outgoing, ALICE)).toBe(BOB)
    expect(otherUserId(outgoing, BOB)).toBe(ALICE)
  })

  it('points a pending request outgoing for the requester and incoming for the addressee', () => {
    expect(directionFor(outgoing, ALICE)).toBe('outgoing')
    expect(directionFor(outgoing, BOB)).toBe('incoming')
  })
})

describe('asFriendshipStatus', () => {
  it('accepts the three contract statuses and rejects anything else', () => {
    expect(asFriendshipStatus('pending')).toBe('pending')
    expect(asFriendshipStatus('accepted')).toBe('accepted')
    expect(asFriendshipStatus('blocked')).toBe('blocked')
    expect(asFriendshipStatus('friends')).toBeNull()
  })
})

describe('isVisibleTo', () => {
  it('shows pending and accepted rows to both sides', () => {
    for (const status of ['pending', 'accepted']) {
      const row = { requester_id: ALICE, addressee_id: BOB, status }
      expect(isVisibleTo(row, ALICE)).toBe(true)
      expect(isVisibleTo(row, BOB)).toBe(true)
    }
  })

  it('shows a block only to the blocker', () => {
    const row = { requester_id: ALICE, addressee_id: BOB, status: 'blocked' }
    expect(isVisibleTo(row, ALICE)).toBe(true)
    // Bob must not be able to tell a block from never having been added.
    expect(isVisibleTo(row, BOB)).toBe(false)
  })

  it('hides a row whose status is not one we understand', () => {
    expect(isVisibleTo({ requester_id: ALICE, addressee_id: BOB, status: 'x' }, ALICE)).toBe(false)
  })
})

describe('presence', () => {
  const joined: string[] = []
  const fakeSocket = (id: string) => ({
    id,
    join: (room: string) => {
      joined.push(`${id}:${room}`)
    },
  })

  beforeEach(() => {
    resetPresence()
    joined.length = 0
  })

  it('puts each socket in its owner’s presence room', async () => {
    await attachPresence(fakeSocket('s1'), ALICE)
    expect(joined).toEqual([`s1:${presenceRoom(ALICE)}`])
  })

  it('reports the first socket as a transition and later ones as not', async () => {
    expect(await attachPresence(fakeSocket('s1'), ALICE)).toBe(true)
    expect(await attachPresence(fakeSocket('s2'), ALICE)).toBe(false)
    expect(isOnline(ALICE)).toBe(true)
  })

  it('only goes offline when the last of several tabs closes', async () => {
    await attachPresence(fakeSocket('s1'), ALICE)
    await attachPresence(fakeSocket('s2'), ALICE)
    expect(detachPresence('s1')).toBeNull()
    expect(isOnline(ALICE)).toBe(true)
    expect(detachPresence('s2')).toBe(ALICE)
    expect(isOnline(ALICE)).toBe(false)
  })

  it('ignores a disconnect from a socket it never saw', () => {
    expect(detachPresence('never-registered')).toBeNull()
  })

  it('filters a list down to the online users', async () => {
    await attachPresence(fakeSocket('s1'), ALICE)
    expect(onlineAmong([ALICE, BOB])).toEqual(new Set([ALICE]))
  })

  it('reads the room from the live socket→seat map', async () => {
    await attachPresence(fakeSocket('s1'), ALICE)
    expect(currentRoomOf(ALICE)).toBeNull()
    setSession('s1', { roomId: 'ABCD', playerId: 'p1' })
    expect(currentRoomOf(ALICE)).toBe('ABCD')
    clearSession('s1')
    expect(currentRoomOf(ALICE)).toBeNull()
  })
})
