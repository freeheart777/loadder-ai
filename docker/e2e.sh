#!/usr/bin/env bash
# Run one browser suite against the Docker services, inside Linux, on a throw-away data volume.
#   docker/e2e.sh medical|education
# It uses its own compose project (loadder-e2e): your dev stack and its data are never touched,
# and no host ports are needed. Screenshots/traces land in ./test-results.
set -euo pipefail
cd "$(dirname "$0")/.."
# The run publishes no host ports and the test container forwards the default ones, so a developer's
# custom LOADDER_*_PORT values must not leak into the URLs baked into the web app and CORS.
unset LOADDER_WEB_PORT LOADDER_API_PORT LOADDER_PUBLIC_PORT
case "${1:-}" in
  medical) spec=e2e/medical/medical-public.spec.ts ;;
  education) spec=e2e/education/education-portal.spec.ts ;;
  *) echo "usage: docker/e2e.sh medical|education" >&2; exit 2 ;;
esac
dc() { docker compose -p loadder-e2e -f compose.yaml -f compose.e2e.yaml --profile e2e "$@"; }
cleanup() { dc down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
dc up -d --build --wait server web
status=0
dc run --rm playwright sh -c 'ffmpeg -loglevel error -y -f lavfi -i testsrc=duration=1:size=160x90:rate=10 -c:v libvpx -b:v 100k "$E2E_VIDEO_FIXTURE" && npx playwright test "$0" --project=chromium' "$spec" || status=$?
if [ "$status" -ne 0 ]; then echo "--- server log (tail) ---" >&2; dc logs --tail 40 server >&2 || true; fi
exit "$status"
