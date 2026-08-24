# features/auth

Client side of player accounts (ClickUp epic 86ey2z15b, subtask B). Pairs with
the server's `modules/auth/`.

- `index.ts` — the **contract** seam: the `AuthState` shape C/D/F/G code against,
  plus the exports implementing it. Don't widen it locally.
- `authStore.ts` — the `useAuth` zustand store. Deliberately **separate from
  `gameStore`**: game state is replaced wholesale on every `game_state`
  broadcast, and the session must not be clobbered by that.
- `api.ts` — `GET /api/auth/me` / `POST /api/auth/logout`. Every failure mode
  (route absent, blank Google credentials, backend down) resolves to
  `enabled: false`, because accounts are optional and a guest must never see an
  error for one being off.
- `AuthMenu.tsx` — the header widget: sign-in button for guests, name chip with
  a drop-down once signed in. Renders **nothing** while loading or when accounts
  are disabled. Mounted in `features/home` and `features/lobby`.
- `Avatar.tsx` — initials, never Google's picture URL: our CSP blocks
  `lh3.googleusercontent.com`, the snippet that would allow it is shared with
  every other app on the box, and hotlinking would leak page views to Google.

`App.tsx` calls `refresh()` once on boot; the OAuth return is a full page load,
so that same call picks up the new cookie. The account-settings menu item points
at `/account`, a route subtask D adds.
