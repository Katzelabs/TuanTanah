# Moved to Katzelabs/platform

The platform stack that lived here — the shared Postgres instance, the `pg_dumpall`
backup sidecar, and `provision-db.sh` — now lives in its own repository:

**https://github.com/Katzelabs/platform**

## Why

This directory held the shared data tier for *every* project on the VPS, not just Tuan
Tanah. Konku, Kasbon and Rinciku all connect to that Postgres, which meant changing it
required opening a Monopoly game's repo. Same category of mistake as an app owning the
edge proxy.

## What this means for Tuan Tanah

Tuan Tanah is now a **tenant** of the platform stack, not its owner:

- It gets its own database and login role (`tuantanah_prod`), provisioned with
  `make provision` in the platform repo.
- It reaches Postgres as `postgres:5432` over the external `platform` Docker network —
  not through a published port, and not via its own `postgres` service.
- The platform repo's `PLATFORM.md` is the deploy contract every app on the box follows.

Redis is deliberately **not** shared and stays in this repo's own compose file: it holds
live game state on the hot path, a flush would drop in-flight games, and it costs ~5MB
idle.

## Migration status

**Complete as of 2026-08-20.** Tuan Tanah runs as a platform tenant:

- `tuantanah_prod` lives on the shared platform Postgres (`pgvector/pgvector:pg18`) and is
  reached as `postgres:5432` over the external `platform` network.
- The `platform` network and the edge exist; the app declares `caddy` labels and the edge
  routes `tuantanah.fun` to it. `web` no longer binds `:80`/`:443`.
- The legacy `tuantanah-postgres-1` container and its `tuantanah_postgres_data` volume were
  **removed on 2026-08-20**. At removal the legacy `tuan_tanah` database contained **no
  application tables** — schema and data had already been re-established on the platform
  instance. A `pg_dumpall` of the legacy cluster is archived in the platform repo under
  `backups/legacy_tuantanah_pg16_20260820T120502Z.sql.gz`.

`docker compose up -d` in this repo is safe again, with one prerequisite: the external
`platform` network must exist (`make net` in the platform repo) and the platform stack must
be up, since `backend` resolves `postgres` over it.

The move was tracked in ClickUp task `86eyn3n07`.
