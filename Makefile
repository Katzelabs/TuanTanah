# Production deploy helpers (run on the VPS, from the repo root).
# Requires a prod .env (see .env.example) and the shared platform stack
# (Katzelabs/platform — Postgres, the edge, and the `platform` network) to be up
# first. This repo is a TENANT of that stack; it never creates or owns it.

.PHONY: deploy up down logs restart ps health migrate net

# One-step redeploy: pull latest, rebuild images, apply migrations, restart.
deploy:
	git pull --ff-only
	$(MAKE) up

# Bring the stack up. Migrations run against the freshly built image BEFORE the
# new backend starts serving, so the schema is never behind the code.
up: net
	docker compose build
	$(MAKE) migrate
	docker compose up -d

down:
	docker compose down

# Restart without rebuilding.
restart:
	docker compose restart

# Follow logs / list containers.
logs:
	docker compose logs -f
ps:
	docker compose ps

# Apply Postgres migrations via a one-shot backend container.
#
# This FAILS the deploy when DATABASE_URL is blank rather than skipping. The old
# skip-and-continue version is the exact silent failure PLATFORM.md documents:
# "[migrate] skipping — DATABASE_URL blank" printed happily while the backend had
# a working connection string, so the app ran against a schema-less database for
# six weeks and swallowed every write. Archival is optional in dev, not in prod.
# To deploy deliberately without it: make up ARCHIVE=off
ARCHIVE ?= on
migrate:
	@if [ "$(ARCHIVE)" = "off" ]; then \
		echo "[migrate] ARCHIVE=off — skipping migrations on purpose"; \
	elif grep -qE '^DATABASE_URL=.+' .env 2>/dev/null; then \
		docker compose run --rm --no-deps backend pnpm migrate; \
	else \
		echo "[migrate] DATABASE_URL is blank in .env — refusing to deploy."; \
		echo "[migrate] Provision the tenant first:"; \
		echo "[migrate]   cd ~/projects/platform && make provision NAME=tuantanah_prod PASS='...'"; \
		echo "[migrate] then put the printed DATABASE_URL in this repo's .env."; \
		echo "[migrate] (Deliberately deploying without archival? make up ARCHIVE=off)"; \
		exit 1; \
	fi

# The platform stack OWNS the `platform` network — this target only asserts it is
# there. Creating it here would be worse than failing: an empty network makes the
# app start and then fail every connection to a Postgres that isn't on it.
net:
	@docker network inspect platform >/dev/null 2>&1 || { \
		echo "[net] the 'platform' network does not exist."; \
		echo "[net] Bring the platform stack up first: cd ~/projects/platform && make up"; \
		exit 1; \
	}

# Quick health check against the backend, through the platform edge. DOMAIN comes
# from .env (make does not read it on its own, so pull it out explicitly).
health:
	@host=$$(grep -E '^DOMAIN=' .env 2>/dev/null | tail -1 | cut -d= -f2-); \
	curl -fsS "https://$${host:-localhost}/api/health" && echo
