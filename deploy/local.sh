#!/usr/bin/env bash
# Local staging stack on this machine (production images, isolated persistent data, loopback only).
#   deploy/local.sh up        build if needed and start; prints the URLs
#   deploy/local.sh status    container health
#   deploy/local.sh logs [service]
#   deploy/local.sh down      stop; the data volume is KEPT
# Data lives in the Docker volume "loadder-local_loadder-data". Deleting it is a separate, explicit decision:
#   docker volume rm loadder-local_loadder-data   (this script never does it)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f deploy/.env.production ] || { echo "create deploy/.env.production first (cp deploy/.env.production.example deploy/.env.production)" >&2; exit 2; }
export LOADDER_VERSION="${LOADDER_VERSION:-local}"
dc() { docker compose -p loadder-local --env-file deploy/.env.production -f deploy/compose.prod.yaml -f deploy/compose.test.yaml -f deploy/compose.local.yaml "$@"; }
case "${1:-}" in
  up)
    dc up -d --build --wait server web
    echo "Loadder (local staging): http://app.localhost   published sites: http://sites.localhost"
    echo "Sign-in codes are shown on the sign-in screen (development mode). Data persists across restarts." ;;
  status) dc ps ;;
  logs) shift; dc logs --tail 80 "$@" ;;
  down) dc down; echo "stopped; data volume kept" ;;
  *) echo "usage: deploy/local.sh up|status|logs [service]|down" >&2; exit 2 ;;
esac
