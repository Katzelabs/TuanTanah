#!/usr/bin/env bash
# Start this worktree's dev stack on its OWN ports, so several tickets from the
# player-accounts epic can run side by side (docs/PARALLEL_TICKETS.md).
#
# Exists because there is no dotenv in this project: bootstrap/env.ts reads
# process.env directly, and in prod compose supplies the file (env_file: .env).
# Locally nothing does — so a .env sitting right there is invisible, and blank
# Google creds are a SUPPORTED state meaning "accounts disabled". The failure is
# therefore silent: the app boots fine and the feature you're building is simply
# off. This script exports the file before handing over to pnpm.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "no .env in $(pwd) — it is gitignored, so it does not come with a worktree."
  echo "copy it from the main checkout first:  cp ../tuan-tanah/.env ."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env
set +a

# PORT is this worktree's backend (set when the worktree was created).
export DEV_SERVER_PORT="${PORT:-3000}"

# The client port comes from PUBLIC_ORIGIN, not from arithmetic on PORT.
# PUBLIC_ORIGIN is what the OAuth redirect_uri is built from, so it is the one
# place that already knows where a browser reaches this app — deriving the port
# any other way lets the two drift, and the failure is nasty: sign-in sends the
# user to a port nothing is serving, long after the config looked fine. Falls
# back to the worktree offset in docs/PARALLEL_TICKETS.md when unset.
_origin_port="$(printf '%s' "${PUBLIC_ORIGIN:-}" | sed -nE 's#^https?://[^:/]+:([0-9]+).*#\1#p')"
export DEV_CLIENT_PORT="${DEV_CLIENT_PORT:-${_origin_port:-$((DEV_SERVER_PORT + 2180))}}"

echo "worktree : $(git branch --show-current)"
echo "backend  : http://localhost:${DEV_SERVER_PORT}"
echo "client   : http://localhost:${DEV_CLIENT_PORT}"
if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
  echo "accounts : enabled"
  echo "           NOTE: Google only accepts redirect URIs registered in the console."
  echo "           ${PUBLIC_ORIGIN}/api/auth/google/callback must be registered"
  echo "           there, or sign-in fails with redirect_uri_mismatch."
else
  echo "accounts : DISABLED (no GOOGLE_CLIENT_ID) — guest-only"
fi

exec pnpm dev
