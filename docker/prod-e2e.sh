#!/usr/bin/env bash
# Run one browser suite against the PRODUCTION images and topology (Caddy edge, built SPA, internal-only
# server, one-shot migrations) on a throw-away volume, inside Linux:
#   docker/prod-e2e.sh medical|education
# The overlay (deploy/compose.test.yaml) keeps production images and wiring but serves plain HTTP on
# *.localhost and uses development-style sign-in so the suites can obtain a code. Production-mode
# behaviour (Secure cookies, no dev OTP, SMS fail-closed) is covered by deploy/prod-auth-check.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  medical) spec=e2e/medical/medical-public.spec.ts ;;
  education) spec=e2e/education/education-portal.spec.ts ;;
  *) echo "usage: docker/prod-e2e.sh medical|education" >&2; exit 2 ;;
esac
[ -f deploy/.env.production ] || { echo "create deploy/.env.production first (copy deploy/.env.production.example)" >&2; exit 2; }
export LOADDER_VERSION="${LOADDER_VERSION:-e2e}"
dc() { docker compose -p loadder-prode2e --env-file deploy/.env.production -f deploy/compose.prod.yaml -f deploy/compose.test.yaml -f deploy/compose.e2e.yaml --profile e2e "$@"; }
cleanup() { dc down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
dc up -d --build --wait server web
status=0
dc run --rm playwright sh -c 'ffmpeg -loglevel error -y -f lavfi -i testsrc=duration=1:size=160x90:rate=10 -c:v libvpx -b:v 100k "$E2E_VIDEO_FIXTURE" && npx playwright test "$0" --project=chromium' "$spec" || status=$?
if [ "$status" -ne 0 ]; then echo "--- server log (tail) ---" >&2; dc logs --tail 40 server >&2 || true; fi
exit "$status"
