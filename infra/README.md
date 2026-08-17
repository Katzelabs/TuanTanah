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

The move is tracked in ClickUp task `86eyn3n07`.

**Do not run `docker compose up -d` in this repo until P2.3 is done.** The compose file
on `main` has no `postgres` service and joins the external `platform` network, but the
box is still running a *older* stack that includes `tuantanah-postgres-1` and the
`platform` network does not exist yet. A deploy from current `main` would fail on the
missing network — and if that network were created first, it would bring the app up
pointing at a Postgres that has no `tuantanah_prod` database.

The live data (`tuan_tanah`, ~7.5 MB, PostgreSQL 16.14, superuser `tuan`) lives in the
`tuantanah_postgres_data` volume and is migrated to the platform instance in P2.3.
