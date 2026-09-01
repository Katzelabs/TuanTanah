# Tuan Tanah 🇮🇩

A real-time multiplayer web-based Monopoly game with an Indonesian theme. 2–8 players, two property tracks, role passives, a pinjol (loan) system, themed cards, and structured negotiation.

See [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) and [`docs/TECHNICAL_REQUIREMENT.md`](docs/TECHNICAL_REQUIREMENT.md) for the full design and architecture.

## Status

The full game loop is playable end-to-end, synced over Socket.io:

- Create / join / leave / rejoin rooms (shareable URLs, seat held by a reconnect token)
- Lobby: pick role, room-master settings, start
- Turns: roll → move → resolve tile (buy property, pay rent, tax, draw card, jail) → end turn
- Meta-actions (invest / work / hustle / sabotage / korupsi / negotiate)
- Property & tier upgrades, downgrades, and sells
- Pinjol (loan) system + debt resolution
- Structured negotiation deals between players
- Role passives, voting, elimination / bankruptcy cascade, and win conditions
- Game-over standings, optionally archived to Postgres

Client extras: neobrutalist design system, framer-motion animations, a sound system, and per-player EN/ID i18n. The engine and the client both have Vitest suites. Remaining work is balance/content tuning and a couple of residual server-side i18n gaps — see `CLAUDE.md`.

## Monorepo layout

```
shared/   ← TypeScript types + all game data (single source of truth, no build step)
server/   ← Fastify + Socket.io + pure game engine
client/   ← React + Vite + Tailwind + Zustand
```

The server is the source of truth. Clients only emit _requests_; the engine resolves them and the server broadcasts the full `GameState`.

## Prerequisites

- Node.js 20+ (tested on 24)
- pnpm 9+ (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- Docker (optional — only needed for Redis persistence or full prod compose)

## Local development

```bash
pnpm install

# optional: persistent state via Redis (otherwise an in-memory store is used)
docker compose -f docker-compose.dev.yml up -d redis

pnpm dev          # server on :3000, client on :5173
```

Then open http://localhost:5173 in two browser tabs to create + join a room.

Useful scripts:

```bash
pnpm test                 # run the engine test suite (Vitest)
pnpm check                # typecheck + lint + format:check (full gate)
pnpm typecheck            # typecheck all workspaces
pnpm --filter server dev  # backend only
pnpm --filter client dev  # frontend only
```

A live gallery of the design-system components is served at http://localhost:5173/design.

### Redis vs in-memory

If `REDIS_URL` is unset or unreachable, the server falls back to an in-memory game store — handy for quick local dev. Set `REDIS_URL` (see `.env.example`) to use Redis so state survives a server restart.

## Production (VPS, HTTPS)

The prod stack is Docker Compose: an internal **Caddy** (serves the built client
and proxies the API), the **backend**, and **redis**. No host build step — the
client is built inside the image.

TLS and Postgres are **not** here. Tuan Tanah is a tenant of the shared platform
stack ([Katzelabs/platform](https://github.com/Katzelabs/platform)): its edge owns
`:80`/`:443` for the whole box and terminates TLS, and one shared Postgres serves
every project with a per-project database (`tuantanah_prod`). Redis stays in this
stack on purpose — it holds live game state.

```bash
cp .env.example .env      # set NODE_ENV, CORS_ORIGINS, DOMAIN, DATABASE_URL
make deploy               # git pull + net check + build + migrate + up -d
```

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full runbook (DNS, firewall, verify, ops).

## Environment

Copy `.env.example` to `.env`. Postgres (game-history archive) is optional — set `DATABASE_URL` and run `pnpm --filter server migrate` to enable it; leave it blank to disable (live state lives in Redis/memory regardless). For local dev, `docker compose -f docker-compose.dev.yml up -d` brings up both Redis and Postgres.

## Versioning

One release number, in two places that a test keeps in agreement:

- `shared/version.ts` → `APP_VERSION`, imported by both tiers (`shared/` has no build step).
- the root `package.json` `version` field — what a human bumps.

`server/test/version.test.ts` fails if they disagree, so a half-finished bump can't ship. The
per-workspace manifests (`client/`, `server/`, `shared/`) are private and never published; their
`version` fields are meaningless and stay put.

Alongside it, `BUILD_SHA` identifies the _commit_ an image came from. `make deploy` resolves it with
`git rev-parse --short HEAD` and passes it to both images as a build arg — `VITE_BUILD_SHA` is baked
into the client bundle by Vite, `BUILD_SHA` is read by the server at boot. It is not in `.env`: a
value pinned in a file would be wrong the moment anything else is deployed. Running from source, both
tiers report `dev`.

Where it surfaces:

- foot of the home page, and the "About" card on `/account` — as `v0.2.0` or `v0.2.0 · 1a2b3c4`
- `GET /api/health` → `version` + `buildSha`
- the server's startup log line

## Changelog

Two different things share the word, so keep them apart:

| Where                      | Audience    | Contains                                                               |
| -------------------------- | ----------- | ---------------------------------------------------------------------- |
| `shared/data/changelog.ts` | **players** | Release notes rendered at `/changelog`, in English **and** Indonesian. |
| `docs/changelog/`          | **us**      | Engineering write-ups — constants, tables, ClickUp links.              |

The player-facing one is written for someone who plays the game, not someone who reads the diff:
"Fixed players being kicked out of their room after losing connection", never "refactor socket
session keying".

**Write the entry in the same PR as the change it describes.** That is the whole mechanism. A
changelog maintained as a separate chore goes stale within two releases, and a page saying the game
stopped moving six months ago is worse than no page — it reads as an abandoned product.
`server/test/changelog.test.ts` enforces the half that can be enforced: the newest entry's version
must equal `APP_VERSION`, so bumping the version without writing the entry fails CI.

## Cutting a release

1. Add the release object to the top of `shared/data/changelog.ts` — newest first, both languages,
   lines grouped by `new` / `improved` / `fixed`.
2. Bump `APP_VERSION` in `shared/version.ts` **and** the root `package.json` to the same number.
3. `pnpm check && pnpm test` — the version-match and changelog tests fail if step 1 or 2 was skipped.
4. `make deploy` on the VPS. It stamps both images with the commit SHA and runs migrations before the
   new backend serves.

Returning players see a one-time, dismissible "what's new" card on the home page; it is keyed off a
per-browser `tuan-tanah:lastSeenVersion` and never shown to a first-time player.
