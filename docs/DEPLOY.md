# Deploying Tuan Tanah to a VPS (production, HTTPS)

The production stack is `docker-compose.yml`: a **web** tier (Caddy serving the
built React client + reverse-proxying the API, with automatic Let's Encrypt
TLS), the **backend** (Fastify + Socket.io), and **redis**. Single instance —
horizontal scaling is out of scope for this deploy.

## Prerequisites

- VPS (Ubuntu/Debian) with Docker + docker-compose installed.
- A **domain** with a DNS **A record** pointing at the VPS IP (AAAA too if you
  have IPv6). Verify it resolves before the first deploy — Let's Encrypt issuance
  fails otherwise:
  ```bash
  dig +short yourdomain.com   # should print the VPS IP
  ```
- A non-root user with Docker access (or sudo), and git access to clone the repo.
- Firewall open on 22, 80, 443:
  ```bash
  sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
  ```
  Ports 80 **and** 443 must be reachable — Caddy uses 80 for the ACME HTTP
  challenge and the HTTP→HTTPS redirect.

## First deploy

```bash
# 1. Clone
git clone <repo-url> tuan-tanah && cd tuan-tanah

# 2. Create the prod .env (gitignored)
cp .env.example .env
```

Edit `.env` and set:

| Var               | Value                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `NODE_ENV`        | `production`                                                                                        |
| `PORT`            | `3000`                                                                                              |
| `CORS_ORIGINS`    | `https://yourdomain.com` (the server refuses to start if this is empty/localhost/wildcard)          |
| `ROOM_TTL_HOURS`  | `24`                                                                                                |
| `DOMAIN`          | `yourdomain.com`                                                                                    |
| `ACME_EMAIL`      | your email (Let's Encrypt expiry notices)                                                           |
| `REDIS_URL`       | leave as-is — compose overrides it to `redis://redis:6379`                                          |
| `VITE_SERVER_URL` | leave **blank** (client talks to the API same-origin)                                               |
| `DATABASE_URL`    | leave as-is — compose points it at the `postgres` service (run `pnpm --filter server migrate` once) |

```bash
# 3. Build + start everything (Caddy auto-issues the TLS cert on first boot)
make deploy        # == git pull + docker compose up -d --build
```

## Verify

```bash
curl -fsS https://yourdomain.com/api/health   # -> {"status":"ok","store":"redis",...}
```

Then open `https://yourdomain.com` in two browser tabs, create a room in one and
join from the other, and confirm the WebSocket stays connected and game state
syncs. Check `store` is `redis` (not `memory`) so state survives restarts.

If certs don't issue: confirm DNS resolves to this box and 80/443 are open, then
`docker compose logs -f web` to watch the ACME exchange.

## Redeploy

```bash
make deploy        # git pull --ff-only + rebuild + restart
```

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
