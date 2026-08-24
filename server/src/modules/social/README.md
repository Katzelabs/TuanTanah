# social — friends and presence

Implements ClickUp subtask **F** (`86eyqjv5h`) of the player-accounts epic
**86ey2z15b**. Socket handlers live in `../../realtime/friends.ts`; the client
half is `client/src/features/social/`.

## Locked decisions

- **Friend code, not name search.** Display names are visible to everyone in a
  room, so a name lookup would turn "I saw you in a game" into "I can find your
  account". A code its owner hands out keeps that under their control and needs
  no search index to exist.
- **One row per pair, not per direction.** `friendships` (migration `0002_auth`)
  stores the friendship once; `requester_id` records who acted — the requester
  while pending, the **blocker** once blocked, which is how "only the blocker can
  unblock" is enforced without a second column. `0004_friend_lookup` adds the
  `least()/greatest()` unique index that actually makes the pair unique: the
  constraint in 0002 is on the ordered tuple, so A→B and B→A would both fit.
- **Presence is "has a live socket", in-process.** No heartbeat, no expiry.
  Every authenticated socket joins `user:<userId>`, so a change pushes to all of
  a player's tabs at once, and only the last socket closing takes them offline.
  Same single-instance caveat as the counters in `../../security.ts`: scaling out
  horizontally means moving this to Redis.
- **Blocks are one-sided information.** The blocker sees the row (to lift it);
  the blocked player sees nothing, and `friends.blocked` is worded so it can't be
  distinguished from an account that simply can't be added.
- **Rejections carry a code, not a sentence.** `FriendsError` holds a key from
  `shared/i18n/messages/friends.ts` and the ack envelope carries it bare, so the
  client renders friend failures in the viewer's language from the same table the
  socket `error` event uses.

## Seams with the other subtasks

- **Subtask A** attaches the account id to the socket. `socketUserId()` in
  `../../realtime/friends.ts` reads `socket.data.userId` — the shape A's own
  README specifies for its `io.use()` middleware. Nothing here imports A's
  not-yet-implemented functions, so F builds and runs on its own; until A lands,
  every socket reads as a guest and the panel shows its signed-out state.
- **Subtask B** owns the client auth store. The friends UI deliberately does not
  import it: whether friends are usable is answered by the server rejecting
  `friend_list`, which is the only thing that actually knows.
- **Subtask D** owns showing the player their _own_ friend code (it belongs on
  the profile, and needs B's store to read it). This ticket owns entering
  somebody else's.
- **Subtask G** must call `isBlockedBetween()` before delivering a room invite —
  a block has to stop invites, not just friend requests.

## Deferred

`FriendSummary.currentRoomId` is read off the live socket→seat map when a list is
built, so it is never stale — but joining or leaving a room does not itself push
an update to friends. Subtask G is the ticket that needs live room transitions
and owns adding them.
