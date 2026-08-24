import type { FriendSummary } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { acceptedFriends, blockedUsers, incomingRequests, outgoingRequests } from './grouping.js'

function entry(
  name: string,
  status: FriendSummary['status'],
  direction: FriendSummary['direction'],
  online = false,
): FriendSummary {
  return {
    user: {
      id: `id-${name}`,
      displayName: name,
      avatarUrl: null,
      friendCode: 'AB12CD34',
      createdAt: '2026-08-24T00:00:00.000Z',
    },
    status,
    direction,
    online,
    currentRoomId: null,
  }
}

const LIST: FriendSummary[] = [
  entry('Ayu', 'accepted', 'outgoing', false),
  entry('Budi', 'accepted', 'incoming', true),
  entry('Citra', 'pending', 'incoming', false),
  entry('Dewi', 'pending', 'outgoing', false),
  entry('Eka', 'blocked', 'outgoing', false),
]

const names = (list: FriendSummary[]) => list.map((f) => f.user.displayName)

describe('friends list grouping', () => {
  it('splits pending requests by which way they point', () => {
    expect(names(incomingRequests(LIST))).toEqual(['Citra'])
    expect(names(outgoingRequests(LIST))).toEqual(['Dewi'])
  })

  it('puts online friends first and keeps the server’s alphabetical order within each half', () => {
    expect(names(acceptedFriends(LIST))).toEqual(['Budi', 'Ayu'])
  })

  it('keeps blocked accounts out of every other group', () => {
    expect(names(blockedUsers(LIST))).toEqual(['Eka'])
    for (const group of [incomingRequests, outgoingRequests, acceptedFriends]) {
      expect(names(group(LIST))).not.toContain('Eka')
    }
  })

  it('does not mutate the list it was given', () => {
    const before = names(LIST)
    acceptedFriends(LIST)
    expect(names(LIST)).toEqual(before)
  })
})
