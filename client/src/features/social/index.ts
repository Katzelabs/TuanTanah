// features/social — friends and presence (ClickUp subtask F of the player-accounts
// epic). Pairs with the server's `modules/social/`.
//
// `FriendsButton` is the whole mounting surface: drop it anywhere and it brings
// up the store, the panel, the unanswered-request badge and the toast. It is
// currently mounted on the home page's control cluster (`features/home/Home`).
export { FriendsButton } from './FriendsButton.js'
export { FriendsPanel } from './FriendsPanel.js'
export { useFriends } from './friendsStore.js'
export {
  acceptedFriends,
  blockedUsers,
  incomingRequests,
  outgoingRequests,
} from './lib/grouping.js'
