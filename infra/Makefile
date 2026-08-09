# Platform stack helpers (run on the VPS, from infra/).

.PHONY: net up down logs ps psql provision backup-now restore

# Create the shared Docker network app stacks join. Idempotent.
net:
	@docker network inspect platform >/dev/null 2>&1 || docker network create platform

up: net
	docker compose up -d
down:
	docker compose down

logs:
	docker compose logs -f
ps:
	docker compose ps

# Interactive superuser shell.
psql:
	docker compose exec postgres psql -U $${POSTGRES_SUPERUSER:-postgres} -d postgres

# Provision a tenant DB + role. EXT is an optional comma-separated extension list.
#   make provision NAME=tuantanah_prod PASS='...'
#   make provision NAME=konku PASS='...' EXT=vector
provision:
	@test -n "$(NAME)" || { echo "usage: make provision NAME=<db> PASS=<password> [EXT=vector]"; exit 64; }
	@test -n "$(PASS)" || { echo "usage: make provision NAME=<db> PASS=<password> [EXT=vector]"; exit 64; }
	./scripts/provision-db.sh "$(NAME)" "$(PASS)" "$(EXT)"

# Force a dump outside the nightly loop.
backup-now:
	docker compose exec -T postgres sh -c 'PGPASSWORD="$$POSTGRES_PASSWORD" pg_dumpall -U "$$POSTGRES_USER" --clean --if-exists' \
		| gzip -9 > "backups/pg_dumpall_manual_$$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
	@ls -lh backups | tail -1

# Restore a dump:  make restore FILE=backups/pg_dumpall_20260810T000000Z.sql.gz
restore:
	@test -n "$(FILE)" || { echo "usage: make restore FILE=backups/<dump>.sql.gz"; exit 64; }
	gunzip -c "$(FILE)" | docker compose exec -T postgres psql -U $${POSTGRES_SUPERUSER:-postgres} -d postgres
