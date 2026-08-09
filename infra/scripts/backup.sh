#!/bin/sh
# pg_dumpall loop for the platform Postgres. Runs inside the postgres-backup
# container (see infra/docker-compose.yml); connection settings come from PG*
# env vars. Dumps every database on the instance, so one job covers all tenants.
set -eu

: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"

mkdir -p /backups

echo "[backup] retention=${BACKUP_RETENTION_DAYS}d interval=${BACKUP_INTERVAL_SECONDS}s"

while true; do
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  out="/backups/pg_dumpall_${ts}.sql.gz"

  echo "[backup] ${ts} dumping -> ${out}"
  if pg_dumpall --clean --if-exists | gzip -9 >"${out}.part"; then
    mv "${out}.part" "${out}"
    echo "[backup] ${ts} ok ($(du -h "${out}" | cut -f1))"
  else
    echo "[backup] ${ts} FAILED — leaving previous dumps untouched" >&2
    rm -f "${out}.part"
  fi

  # Prune only completed dumps, and only after a successful-or-failed cycle, so a
  # broken dump never silently expires the last good one.
  find /backups -name 'pg_dumpall_*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete

  sleep "${BACKUP_INTERVAL_SECONDS}"
done
