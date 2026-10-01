#!/usr/bin/env bash
set -euo pipefail

# Isolated Education gate: fresh SQLite + media dir, local API and Vite server,
# torn down on exit. The public-app router is enabled because students sign in
# through the existing app-user invite flow.
dir="$(mktemp -d "${TMPDIR:-/tmp}/loadder-education-e2e.XXXXXX")"
api_port="${EDU_E2E_API_PORT:-3216}"
web_port="${EDU_E2E_WEB_PORT:-4181}"
api_base="http://127.0.0.1:${api_port}"
web_base="http://127.0.0.1:${web_port}"
api_pid=""; web_pid=""

cleanup() {
  test -z "$web_pid" || kill "$web_pid" 2>/dev/null || true
  test -z "$api_pid" || kill "$api_pid" 2>/dev/null || true
  test -z "$web_pid" || wait "$web_pid" 2>/dev/null || true
  test -z "$api_pid" || wait "$api_pid" 2>/dev/null || true
  rm -rf "$dir"
}
trap cleanup EXIT INT TERM

ffmpeg_bin="${FFMPEG_BIN:-$(command -v ffmpeg || true)}"
test -n "$ffmpeg_bin" || { echo "ffmpeg is required to generate the video fixture" >&2; exit 1; }
"$ffmpeg_bin" -loglevel error -f lavfi -i testsrc=duration=1:size=160x90:rate=10 -c:v libvpx -b:v 100k "$dir/performance.webm"

DATABASE_PATH="$dir/education.sqlite" SITE_MEDIA_LOCAL_DIR="$dir/media" \
NODE_ENV=test API_HOST=127.0.0.1 API_PORT="$api_port" \
AUTH_EXPOSE_DEV_OTP=true AUTH_HASH_SECRET=education-e2e-secret \
BUSINESS_BUILDER_PUBLIC_APPS_ENABLED=true CLIENT_ORIGINS="$web_base" \
node server/index.mjs >"$dir/backend.log" 2>&1 &
api_pid="$!"

VITE_API_BASE_URL="$api_base" npx vite --host 127.0.0.1 --port "$web_port" --strictPort >"$dir/frontend.log" 2>&1 &
web_pid="$!"

for _ in $(seq 1 40); do
  if curl --fail --silent "$api_base/api/health" >/dev/null && curl --fail --silent "$web_base/" >/dev/null; then
    E2E_API_BASE_URL="$api_base" E2E_BASE_URL="$web_base" E2E_DATABASE_PATH="$dir/education.sqlite" E2E_VIDEO_FIXTURE="$dir/performance.webm" \
      npx playwright test e2e/education/education-portal.spec.ts --project=chromium
    exit 0
  fi
  sleep 1
done
cat "$dir/backend.log" >&2 || true
exit 1
