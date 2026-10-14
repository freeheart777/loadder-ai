# Shared helpers for deploy/*.sh (sourced). Override LOADDER_PROJECT / LOADDER_COMPOSE_EXTRA for isolated test runs.
cd "$(dirname "${BASH_SOURCE[0]}")/.."
LOADDER_PROJECT="${LOADDER_PROJECT:-loadder-prod}"
dc() { docker compose -p "$LOADDER_PROJECT" --env-file deploy/.env.production -f deploy/compose.prod.yaml ${LOADDER_COMPOSE_EXTRA:-} "$@"; }
wait_healthy() { # service, seconds
  local svc="$1" end=$((SECONDS + ${2:-180}))
  while [ "$SECONDS" -lt "$end" ]; do
    [ "$(dc ps --format '{{.Service}}={{.Health}}' | grep -c "^$svc=healthy")" -ge 1 ] && return 0
    sleep 3
  done
  return 1
}
