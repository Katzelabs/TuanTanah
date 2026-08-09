# Production deploy helpers (run on the VPS, from the repo root).
# Requires a prod .env (see .env.example) and the shared platform stack from
# infra/ (Postgres + the `platform` Docker network) to be up first.

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

# Apply Postgres migrations via a one-shot backend container. Skipped when
# DATABASE_URL is blank, since game-history archival is optional.
migrate:
	@if grep -qE '^DATABASE_URL=.+' .env 2>/dev/null; then \
		docker compose run --rm --no-deps backend pnpm migrate; \
	else \
		echo "[migrate] DATABASE_URL blank in .env — skipping (archival disabled)"; \
	fi

# The shared network the platform stack's Postgres lives on. Idempotent.
net:
	@docker network inspect platform >/dev/null 2>&1 || docker network create platform

# Quick health check against the backend through Caddy.
health:
	curl -fsS https://$${DOMAIN:-localhost}/api/health && echo
