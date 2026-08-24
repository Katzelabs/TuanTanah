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
