# auth — player accounts

Implements ClickUp epic **86ey2z15b**. `index.ts` is the **contract**: the
signatures other subtasks import. Subtask A fills in the implementations.

## Locked decisions

- **Google OAuth only.** No passwords, therefore no hashing, no email provider,
  no reset or verification flow. A second provider is a row in
  `auth_identities`, not a refactor.
- **Scopes are `openid`, `email`, `profile` — nothing else.** These are
  non-sensitive, so there is no Google verification review and no cost. Adding
  any scope beyond these changes both.
- **Sessions are opaque random tokens in Redis** (`sess:<id>` → userId), sent as
  an `httpOnly; Secure; SameSite=Lax` cookie. No JWT: no signing secret to
  manage, and revocation is instant.
- **Same-origin.** Caddy proxies `/api` and `/socket.io` in prod, Vite in dev, so
  the cookie is first-party — no CORS-credentials work.
- **Guest stays first-class.** Blank credentials disable accounts and the game
  remains fully playable. An invite link must never hit a login wall.

## Shape

- Routes: `GET /api/auth/google` → `GET /api/auth/google/callback`,
  `POST /api/auth/logout`, `GET /api/auth/me`.
- Google's tokens are discarded after one userinfo call — nothing at rest.
- An `io.use()` middleware reads the cookie and attaches `userId` to the socket,
  alongside `connectionGate` in `../../security.ts`. `rooms/sessions.ts` carries
  an optional `userId`.
- Schema lives in `../../persistence/migrations/0002_auth.ts`.

Guests keep the existing `reconnectTokens` seat flow unchanged — do **not**
rework seat reclaim around `userId`.

## What is here now (subtask A)

| File              | Role                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `index.ts`        | the contract — `authEnabled`, session CRUD, `getUser`                |
| `routes.ts`       | the four HTTP routes; registered from `bootstrap/index.ts`           |
| `socket.ts`       | `authGate`, the `io.use()` middleware, and the `socket.data` shape   |
| `sessionStore.ts` | `sess:<id>` → userId in Redis, in-memory fallback                    |
| `users.ts`        | the only writer of `users` / `auth_identities`                       |
| `google.ts`       | scopes, callback URI, the single userinfo call                       |
| `cookie.ts`       | the session cookie's name and flags, shared by routes and the socket |

For B–G: read identity off `socket.data.userId` (typed via `TTSocket` in
`realtime/common.ts`) or off `Session.userId` in `rooms/sessions.ts` — both are
**optional**, and absent means guest, which is a normal state and not an error.

`authEnabled()` requires `DATABASE_URL` as well as the Google credentials:
accounts are rows in Postgres, so credentials without a database would render a
sign-in button that fails at the callback. The server logs which of the two is
missing at startup.
