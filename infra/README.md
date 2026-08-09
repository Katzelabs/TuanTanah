# Platform stack

Shared data tier for the VPS: one **Postgres 17 (`pgvector/pgvector:pg17`)** instance
plus a nightly `pg_dumpall` job. Every project on the box connects to it over the
external `platform` Docker network, each with its **own database and login role**.

Why shared: Postgres in Tuan Tanah is archival only — `persistGameResult` writes two
rows when a game ends, the pool is capped at 4, and a failure is swallowed so it never
disrupts a live game. That workload doesn't justify a dedicated instance (~100–200MB
idle each), and consolidating gives one backup job and one thing to patch.

Why **not** shared Redis: Redis holds live game state, so it's on the hot path, and a
flush would drop in-flight games. It costs ~5MB idle, so each app stack runs its own.

## Version policy — read before adding a tenant

**Every tenant shares one major version and one upgrade window.** That is the real
cost of consolidating, so the instance tracks the _most demanding_ tenant:

| Tenant         | Needs                      |
| -------------- | -------------------------- |
| konku          | Postgres 17 + `pgvector`   |
| tuantanah_prod | any version; no extensions |

Hence `pgvector/pgvector:pg17` — stock Postgres 17 with the `vector` extension
available. Change it in one place, `POSTGRES_IMAGE` in `infra/.env`; both the server
and the backup container read it, because a `pg_dumpall` client older than the server
refuses to run.

Consequences to plan around:

- A major-version bump (17 → 18) is a **coordinated migration for all tenants** —
  dump, recreate the volume, restore. Not a rolling per-project decision.
- `docker-compose.dev.yml` in each project should track the same major version, or
  local dev silently tests against a different engine than prod.
- Extensions are **per-database**, and untrusted ones (pgvector included) need
  superuser — so `provision-db.sh` installs them, not the tenant's own migrations.

## Layout

```
infra/
  docker-compose.yml    postgres + postgres-backup, joined to the `platform` network
  Makefile              net / up / down / psql / provision / backup-now / restore
  .env.example          image pin + superuser credentials + backup retention
  scripts/
    provision-db.sh     create a tenant database + owning role + extensions (idempotent)
    backup.sh           the dump loop that runs inside postgres-backup
  backups/              dumps land here (gitignored)
```

## First-time setup on the VPS

```bash
cd infra
cp .env.example .env
# set POSTGRES_SUPERUSER_PASSWORD to something long and random, e.g.
#   openssl rand -base64 32

make up                 # creates the `platform` network, then starts Postgres
```

Provision the Tuan Tanah production database:

```bash
make provision NAME=tuantanah_prod PASS="$(openssl rand -base64 24 | tr -d '/+=')"
```

It prints the `DATABASE_URL` to paste into the app stack's `.env`. The host is
`postgres` — the service name resolves over the `platform` network, not `localhost`:

```
DATABASE_URL=postgres://tuantanah_prod:<password>@postgres:5432/tuantanah_prod
```

Then, from the repo root, `make deploy` (or `make migrate`) applies the schema.

## Adding another environment or project

Same command, different name — plus `EXT=` for anything that needs an extension:

```bash
make provision NAME=tuantanah_staging PASS='...'
make provision NAME=konku PASS='...' EXT=vector
```

Then point the tenant's app stack at `postgres:5432` over the `platform` network and
drop its own `postgres` service from its production compose file. Its _dev_ compose
(e.g. konku's `pgvector/pgvector:pg17` on port 5433) stays as-is — self-contained
local dev is the right default, and CI needs it.

Never point two stacks at the same database. Kysely's migration bookkeeping
(`kysely_migration`, `kysely_migration_lock`) and generic table names like `games`
live in `public` and will collide.

`make provision` is idempotent, so re-running it rotates a password or adds an
extension to an existing tenant.

## Backups

`postgres-backup` runs `pg_dumpall` every `BACKUP_INTERVAL_SECONDS` (default 24h)
into `infra/backups/`, keeping `BACKUP_RETENTION_DAYS` (default 14) of dumps. It
dumps _all_ databases, so one job covers every tenant.

```bash
make backup-now                                       # dump immediately
make restore FILE=backups/pg_dumpall_20260810T000000Z.sql.gz
```

`infra/backups/` is local disk only. Ship it off-box (rclone/S3/borg) before you
have data you'd miss.

## Security notes

- Postgres publishes **`127.0.0.1:5432`** only, for `psql` from the VPS shell. App
  traffic goes over the `platform` network. Never widen this to `0.0.0.0`.
- Tenant roles are plain `LOGIN` roles owning exactly one database. `CONNECT` is
  revoked from `PUBLIC` on each, so tenants can't reach each other.
- `infra/.env` holds the superuser password and is gitignored. Back it up somewhere
  that isn't this VPS.
