#!/usr/bin/env bash
# Upgrade a running deployment to the code in this checkout:
#   deploy/upgrade.sh [--no-backup]
# backup -> build (tagged with the git SHA) -> up (migrations run first) -> health -> smoke test.
# The previous images stay on the host, so a rollback does not need a rebuild (see docs/DOCKER_D2.md).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
set -a; . deploy/.env.production; set +a
previous="$(docker inspect -f '{{ index .Config.Image }}' "$(dc ps -q server 2>/dev/null | head -1)" 2>/dev/null | sed 's/.*://' || true)"
export LOADDER_VERSION="$(git rev-parse --short HEAD)"
echo "Upgrading to $LOADDER_VERSION (running: ${previous:-none})"
[ "${1:-}" = "--no-backup" ] || bash deploy/backup.sh deploy/backups/pre-upgrade-"$LOADDER_VERSION"
dc build
dc up -d --remove-orphans
if wait_healthy server 240 && wait_healthy web 60; then
  bash deploy/smoke.sh "$LOADDER_APP_HOST" "$LOADDER_SITES_HOST" && echo "Upgrade to $LOADDER_VERSION OK." && exit 0
fi
echo "UPGRADE FAILED. Roll back:  LOADDER_VERSION=${previous:-<previous>} docker compose -p $LOADDER_PROJECT --env-file deploy/.env.production -f deploy/compose.prod.yaml up -d" >&2
echo "If migrations ran, also restore the pre-upgrade backup in deploy/backups/pre-upgrade-$LOADDER_VERSION (deploy/restore.sh)." >&2
exit 1
