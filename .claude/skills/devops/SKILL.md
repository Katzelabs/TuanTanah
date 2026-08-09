---
name: devops
description: Build, deploy, and tooling for Tuan Tanah — pnpm monorepo scripts, the check gate, the shared platform stack in infra/ (Postgres + backups), the app Docker Compose stack (Caddy + backend + Redis), Caddy reverse proxy/TLS, env vars, GitHub Actions, and the deploy Makefile. Use for CI/build/deploy/env/config changes.
---

# DevOps — Tuan Tanah

pnpm monorepo (`pnpm@9.15.0`, Node ≥20), three workspaces. **No build step for the server** — it runs via `tsx` in dev and prod. Only the client is bundled (Vite). CI runs on GitHub Actions (`.github/workflows/ci.yml`); deploys are `make deploy` on the VPS, triggerable manually from `.github/workflows/deploy.yml`.

## Scripts (root `package.json`)

```bash
pnpm dev          # server :3000 + client :5173 in parallel
pnpm dev:server   # backend only
pnpm dev:client   # frontend only
pnpm build        # client → client/dist (Vite)
pnpm test         # server engine tests, then client tests (vitest)
pnpm typecheck    # tsc --noEmit across all workspaces (pnpm -r)
pnpm lint         # eslint .   (lint:fix to autofix)
pnpm format       # prettier --write .   (format:check to verify)
pnpm check        # typecheck + lint + format:check — the full gate
pnpm redis        # docker compose -f docker-compose.dev.yml up -d redis
pnpm --filter server migrate   # apply Postgres migrations (needs DATABASE_URL)
```

Use **pnpm**, never npm. `pnpm check` is the authoritative gate; run it after changes.

## Local dev stack

`docker-compose.dev.yml` provides optional `redis` (7-alpine, :6379) and `postgres` (**17**-alpine, :5432, user/pass/db = `tuan`/`tuan`/`tuan_tanah`, healthchecked). Neither is required for basic dev — without `REDIS_URL` state is in-memory, without `DATABASE_URL` archival no-ops. The Postgres major version deliberately matches the shared platform instance; bumping it needs `docker compose -f docker-compose.dev.yml down -v`.

## Production: two stacks

Prod on the VPS is split into a **platform stack** (shared data tier) and the **app stack**, joined by an external Docker network named `platform`. Create it once with `docker network create platform` (or `make -C infra net`).

### Platform stack: `infra/docker-compose.yml`

Shared across every project on the VPS. See `infra/README.md`.

- **postgres** — `${POSTGRES_IMAGE:-pgvector/pgvector:pg17}`, `postgres_data` volume, published on **`127.0.0.1:5432` only** (app traffic goes over the `platform` network). Superuser creds in `infra/.env`.
- **postgres-backup** — same image (a `pg_dumpall` client older than the server refuses to run), loops dumps into `infra/backups/` (`BACKUP_INTERVAL_SECONDS`, `BACKUP_RETENTION_DAYS`).

**Version policy:** all tenants share one major version and one upgrade window, so the image tracks the most demanding tenant — currently konku (pg17 + pgvector). `docker-compose.dev.yml` here uses `postgres:17-alpine` to match. A major bump is a coordinated dump/restore for every tenant, not a per-project call.

Each project gets its **own database + owning login role**, never a shared database — Kysely's `kysely_migration` tables and generic names like `games` collide otherwise. Provision with `make -C infra provision NAME=tuantanah_prod PASS='...'` (add `EXT=vector` for extension-needing tenants; extensions are per-database and untrusted ones need superuser). It prints the `DATABASE_URL` — host is `postgres`, not localhost.

### App stack: `docker-compose.yml` (project name `tuantanah`)

- **web** — multi-stage build (Node 20 build → `caddy:2-alpine`), serves the SPA from `/srv` and reverse-proxies `/api/*` + `/socket.io/*` to `backend:3000`. Auto-TLS via Caddy. `caddy_data`/`caddy_config` volumes persist certs. `VITE_PUBLIC_URL` is a **build arg** (Vite bakes `VITE_*` at build time) — so prod and staging need separate image builds.
- **backend** — `server/Dockerfile` (Node 20, corepack, `pnpm install --frozen-lockfile --prod`, `tsx src/bootstrap/index.ts`), :3000, healthcheck on `/api/health`. On both `default` and `platform` networks. `DATABASE_URL` comes from `.env` and is **not** overridden in compose; `REDIS_URL` is.
- **redis** — 7, `redis_data` volume, healthcheck `redis-cli ping`. Deliberately **not** shared between projects: it holds live game state.

Don't scale `backend` past one replica — there's no `@socket.io/redis-adapter`, so instances wouldn't share rooms.

## Caddy (`Caddyfile`)

Reverse proxy + static SPA fallback (`try_files {path} /index.html`) with hardened headers set at the edge: HSTS, `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, a strict CSP (`script-src 'self'`, `connect-src 'self' wss:`), 64KB request-body cap, `-Server`. Edit headers here, not in the app.

## Environment variables (`.env.example`)

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=                       # blank → archival disabled; prod → postgres://tuantanah_prod:…@postgres:5432/tuantanah_prod
REDIS_URL=redis://localhost:6379    # blank → in-memory store (prod: overridden to redis://redis:6379)
CORS_ORIGINS=http://localhost:5173  # REQUIRED in prod; blank/wildcard/localhost refuse to start
ROOM_TTL_HOURS=24
VITE_SERVER_URL=                    # blank → dev proxy / same-origin
VITE_PUBLIC_URL=                    # blank → root-relative; set for social previews (build arg)
DOMAIN=tuantanah.fun               # prod
ACME_EMAIL=you@example.com         # prod (Caddy TLS)
```

`infra/.env` is separate (`POSTGRES_SUPERUSER`, `POSTGRES_SUPERUSER_PASSWORD`, backup knobs). `.gitignore` ignores `.env` and `.env.*` with `!.env.example`, so per-environment files are safe to add.

## Deploy (`Makefile`)

```bash
make deploy   # git pull --ff-only && make up
make up       # net + docker compose build + make migrate + docker compose up -d
make migrate  # one-shot `docker compose run --rm --no-deps backend pnpm migrate`; skipped if DATABASE_URL blank
make net      # create the shared `platform` network (idempotent)
make down / restart / logs / ps
make health   # curl -fsS https://${DOMAIN}/api/health
```

Migrations run **between build and up**, so the schema is never behind the running code.

## CI/CD (`.github/workflows/`)

- **`ci.yml`** — push to `main` + PRs: `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm test` → `pnpm build`. No services needed (engine is pure; store falls back to in-memory).
- **`deploy.yml`** — `workflow_dispatch` only: SSHes to the VPS and runs `make deploy`, then `make health`. Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_DIR`, optional `VPS_PORT`. The VPS builds its own images; if that starves the box, switch to building in CI and pushing to GHCR.

## Tooling configs

- `eslint.config.js` — TypeScript-ESLint flat config; ignores `dist`/`node_modules`; Node globals for server/shared, browser + React-hooks for client; `_`-prefixed throwaways allowed; Prettier last. 0 errors required.
- `.prettierrc.json` — no semi, single quotes, trailing-comma all, printWidth 100, arrow-parens always.
- `tsconfig.base.json` — ES2022, `Bundler` resolution, strict + `verbatimModuleSyntax` + `isolatedModules`.
- Vitest configs: `server/vitest.config.ts` (node, inlines `@tuan-tanah/shared`), `client/vitest.config.ts` (jsdom).
- `.claude/hooks/format-and-lint.sh` — PostToolUse hook; auto-runs prettier + eslint --fix on edited files, surfaces unfixable lint errors (exit 2).

When adding CI later, mirror `pnpm check && pnpm test` as the gate.
