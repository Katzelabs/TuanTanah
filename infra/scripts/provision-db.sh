#!/usr/bin/env bash
# Provision one tenant on the shared platform Postgres: a dedicated database plus
# a dedicated login role that owns it. Idempotent — safe to re-run to rotate the
# password or to add a second environment later.
#
#   ./scripts/provision-db.sh tuantanah_prod '<password>'
#   ./scripts/provision-db.sh tuantanah_staging '<password>'
#   ./scripts/provision-db.sh konku '<password>' vector
#
# The optional third argument is a comma-separated list of extensions to install
# INTO that database. Extensions are per-database, and untrusted ones (pgvector
# included) need superuser — which is why they're created here rather than by the
# tenant's own migrations.
#
# The resulting DATABASE_URL for the app stack's .env is printed at the end.
set -euo pipefail

NAME=${1:-}
PASS=${2:-}
EXTENSIONS=${3:-}

if [[ -z $NAME || -z $PASS ]]; then
  echo "usage: $0 <db_and_role_name> <password> [ext1,ext2]" >&2
  exit 64
fi

if [[ ! $NAME =~ ^[a-z_][a-z0-9_]*$ ]]; then
  echo "error: name must be lowercase alphanumeric/underscore (got '$NAME')" >&2
  exit 64
fi

cd "$(dirname "$0")/.."

# Pick up POSTGRES_SUPERUSER from the same .env docker compose reads.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

SUPERUSER=${POSTGRES_SUPERUSER:-postgres}

# -T: no TTY, so this works over ssh and from CI.
psql_super() {
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$SUPERUSER" -d postgres "$@"
}

# Same, but connected to the tenant database (extensions are per-database).
psql_tenant() {
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$SUPERUSER" -d "$NAME" "$@"
}

# Escape single quotes for the SQL string literal.
PASS_SQL=${PASS//\'/\'\'}

echo "[provision] role: $NAME"
psql_super <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${NAME}') THEN
    ALTER ROLE "${NAME}" WITH LOGIN PASSWORD '${PASS_SQL}';
  ELSE
    CREATE ROLE "${NAME}" WITH LOGIN PASSWORD '${PASS_SQL}';
  END IF;
END
\$\$;
SQL

if psql_super -tAc "SELECT 1 FROM pg_database WHERE datname = '${NAME}'" | grep -q 1; then
  echo "[provision] database: $NAME (already exists)"
else
  echo "[provision] database: $NAME (creating)"
  psql_super -c "CREATE DATABASE \"${NAME}\" OWNER \"${NAME}\""
fi

# Keep tenants out of each other's databases. PG15+ already drops CREATE on the
# public schema for PUBLIC, so ownership plus this REVOKE is enough isolation.
echo "[provision] revoking PUBLIC connect on $NAME"
psql_super -c "REVOKE CONNECT ON DATABASE \"${NAME}\" FROM PUBLIC" \
  -c "GRANT CONNECT ON DATABASE \"${NAME}\" TO \"${NAME}\""

if [[ -n $EXTENSIONS ]]; then
  IFS=',' read -ra exts <<<"$EXTENSIONS"
  for ext in "${exts[@]}"; do
    ext=$(echo "$ext" | tr -d '[:space:]')
    [[ -z $ext ]] && continue
    if [[ ! $ext =~ ^[a-z_][a-z0-9_]*$ ]]; then
      echo "error: bad extension name '$ext'" >&2
      exit 64
    fi
    echo "[provision] extension: $ext in $NAME"
    psql_tenant -c "CREATE EXTENSION IF NOT EXISTS \"${ext}\""
  done
fi

echo
echo "[provision] done. Put this in the app stack's .env:"
echo
echo "  DATABASE_URL=postgres://${NAME}:<password>@postgres:5432/${NAME}"
echo
echo "Then apply the schema from the app stack:  make migrate"
