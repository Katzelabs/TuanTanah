# Deploying Tuan Tanah to the VPS (production)

Tuan Tanah is a **tenant** of the shared platform stack
([Katzelabs/platform](https://github.com/Katzelabs/platform)), not a self-contained
deployment. Two things it used to own now live there:

- **TLS and the public ports.** The platform **edge** (`compose/edge.yml`,
  caddy-docker-proxy) is the only process on the box that binds `:80`/`:443`. It
  terminates TLS once for every site and reverse-proxies over the `platform`
  Docker network. This stack publishes **no ports**.
- **Postgres.** One shared instance serves every project, each with its own
  database and owning role. Tuan Tanah's is `tuantanah_prod`.

What stays here: the **web** tier (an internal `caddy:2-alpine` serving the built
SPA and proxying `/api/*` + `/socket.io/*`), the **backend** (Fastify +
Socket.io), and **redis** — deliberately not shared, because it holds live game
state on the hot path and a flush would drop in-flight games.

Read `PLATFORM.md` in the platform repo first; it is the deploy contract every
app on the box follows. This file is only the Tuan Tanah specifics.

## Prerequisites

- The platform stack is up: the `platform` network exists, the edge is running,
  and Postgres is healthy. `make net` here fails loudly if the network is missing.
- A **DNS A record** for `DOMAIN` pointing at the VPS IP (AAAA too if you have
  IPv6). The **edge** issues the certificate, so this must resolve before the
  first request, not before this stack starts:
  ```bash
  dig +short tuantanah.fun   # should print the VPS IP
  ```
- A non-root user in the `docker` group, and git access to clone the repo.
- Firewall: only 22/80/443 open, and only the edge is behind 80/443.

## First deploy

```bash
# 1. Clone
git clone <repo-url> tuan-tanah && cd tuan-tanah

# 2. Provision this app's database on the shared Postgres (from the platform repo)
cd ~/projects/platform
make provision NAME=tuantanah_prod PASS="$(openssl rand -base64 24)"
# -> prints DATABASE_URL=postgres://tuantanah_prod:<password>@postgres:5432/tuantanah_prod

# 3. Create the prod .env (gitignored, mode 600)
cd -
cp .env.example .env && chmod 600 .env
```

Edit `.env` and set:

| Var               | Value                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `NODE_ENV`        | `production`                                                                              |
| `PORT`            | `3000`                                                                                    |
| `CORS_ORIGINS`    | `https://tuantanah.fun` (the server refuses to start if this is empty/localhost/wildcard) |
| `ROOM_TTL_HOURS`  | `24`                                                                                      |
| `DOMAIN`          | `tuantanah.fun` — the public hostname, used for the `caddy` label the edge routes on      |
| `DATABASE_URL`    | the string `make provision` printed. Host is `postgres`, never localhost, never a port    |
| `REDIS_URL`       | leave as-is — compose overrides it to `redis://redis:6379`                                |
| `VITE_SERVER_URL` | leave **blank** (client talks to the API same-origin)                                     |
| `VITE_PUBLIC_URL` | `https://tuantanah.fun` — baked into `index.html` at build time for share previews        |
| `SENTRY_DSN`      | error tracking; blank disables it and nothing else changes                                |

There is no `ACME_EMAIL`: this stack never obtains a certificate.

```bash
# 4. Build, migrate, start
make deploy        # git pull --ff-only + net + build + migrate + up -d
```

The edge picks the container up within a couple of seconds. Nothing in the
platform repo changes, and the edge is not restarted.

## Verify

```bash
make health        # curl https://$DOMAIN/api/health -> {"status":"ok","store":"redis",...}
```

Check `store` is `redis` (not `memory`) so live state survives restarts. Then open
the site in two browser tabs, create a room in one and join from the other, and
confirm the WebSocket stays connected and state syncs.

Verify the **effect**, not the exit code — after a schema change, list the tables,
don't trust the migration log:

```bash
cd ~/projects/platform
docker compose --env-file .env -f compose/postgres.yml exec -T postgres \
  psql -U postgres -d tuantanah_prod -c '\dt'
# expect: games, game_players, kysely_migration, kysely_migration_lock
```

## Redeploy

```bash
make deploy
```

`make up` runs migrations **between build and start**, against the freshly built
image, so the schema is never behind the code. If `DATABASE_URL` is blank the
deploy **fails** rather than skipping — that skip is the documented six-week
silent failure in `PLATFORM.md`. To deploy without archival on purpose:
`make up ARCHIVE=off`.

## Ops

- **Logs:** `make logs` (or `docker compose logs -f web|backend|redis`).
- **Survives reboot:** every service is `restart: unless-stopped`; ensure Docker
  starts on boot — `sudo systemctl enable docker`.
- **Cert renewal:** not this stack's job — the platform edge terminates TLS and
  renews in the background. See `PLATFORM.md` in Katzelabs/platform.
- **Persistence:** Redis uses a named volume (`redis_data`) with AOF on, so game
  state survives restarts (bounded by `ROOM_TTL_HOURS`). It is the only stateful
  volume this stack owns — back it up if persistence matters. Postgres lives in
  the platform stack and is backed up there by the `pg_dumpall` sidecar.

## Local test of the prod stack (optional)

This stack no longer binds `:80`/`:443` or terminates TLS, so it cannot be
exercised end-to-end on its own — `web` listens on plain HTTP `:80` on the
internal `platform` network and expects the edge in front of it. To test the
containers in isolation, `docker compose up --build` and hit `web` directly over
the compose network; for a full HTTPS path you need the platform edge running
too. Use `docker-compose.dev.yml` for ordinary local development.
