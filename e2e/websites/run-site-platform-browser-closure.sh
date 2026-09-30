#!/usr/bin/env bash
set -euo pipefail

# Reproducible local closure gate. All state and logs stay in a fresh temporary
# directory; the trap tears down both servers and removes SQLite/WAL/SHM files.
closure_dir="$(mktemp -d "${TMPDIR:-/tmp}/loadder-site-platform-e2e.XXXXXX")"
api_port="${SITE_PLATFORM_E2E_API_PORT:-3214}"
web_port="${SITE_PLATFORM_E2E_WEB_PORT:-4179}"
api_base="http://127.0.0.1:${api_port}"
web_base="http://127.0.0.1:${web_port}"
api_pid=""
web_pid=""

cleanup() {
  test -z "$web_pid" || kill "$web_pid" 2>/dev/null || true
  test -z "$api_pid" || kill "$api_pid" 2>/dev/null || true
  test -z "$web_pid" || wait "$web_pid" 2>/dev/null || true
  test -z "$api_pid" || wait "$api_pid" 2>/dev/null || true
  rm -rf "$closure_dir"
}
trap cleanup EXIT INT TERM

DATABASE_PATH="$closure_dir/site-platform.sqlite" \
SITE_MEDIA_LOCAL_DIR="$closure_dir/media" \
NODE_ENV=test API_HOST=127.0.0.1 API_PORT="$api_port" \
AUTH_EXPOSE_DEV_OTP=true AUTH_HASH_SECRET=site-platform-e2e-secret \
CLIENT_ORIGINS="$web_base" \
node server/index.mjs >"$closure_dir/backend.log" 2>&1 &
api_pid="$!"

VITE_API_BASE_URL="$api_base" npx vite --host 127.0.0.1 --port "$web_port" --strictPort \
  >"$closure_dir/frontend.log" 2>&1 &
web_pid="$!"

for attempt in $(seq 1 40); do
  if curl --fail --silent "$api_base/api/health" >/dev/null && curl --fail --silent "$web_base/" >/dev/null; then
    E2E_API_BASE_URL="$api_base" E2E_BASE_URL="$web_base" \
      npx playwright test e2e/websites/site-platform-browser-closure.spec.ts --project=chromium
    exit 0
  fi
  sleep 1
done

cat "$closure_dir/backend.log" >&2 || true
cat "$closure_dir/frontend.log" >&2 || true
exit 1
