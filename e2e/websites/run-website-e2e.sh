#!/usr/bin/env bash
set -euo pipefail

# Native Website Builder browser runner with the REAL public-site runtime.
#   e2e/websites/run-website-e2e.sh [playwright args]     (default: the release flow)
# API, public-site runtime (the origin that serves published sites and private preview links) and Vite
# run on loopback with a throw-away database and media directory; nothing outside the temp dir is touched.
dir="$(mktemp -d "${TMPDIR:-/tmp}/loadder-website-e2e.XXXXXX")"
api_port="${WEBSITE_E2E_API_PORT:-3217}"
site_port="${WEBSITE_E2E_SITE_PORT:-3218}"
web_port="${WEBSITE_E2E_WEB_PORT:-4181}"
api_base="http://127.0.0.1:${api_port}"
site_base="http://127.0.0.1:${site_port}"
web_base="http://127.0.0.1:${web_port}"
pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do test -z "$pid" || kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]:-}"; do test -z "$pid" || wait "$pid" 2>/dev/null || true; done
  rm -rf "$dir"
}
trap cleanup EXIT INT TERM

export DATABASE_PATH="$dir/e2e.sqlite" SITE_MEDIA_LOCAL_DIR="$dir/media" MEDICAL_DOCUMENT_DEV_DIR="$dir/private"
export NODE_ENV=test API_HOST=127.0.0.1 API_PORT="$api_port" PUBLIC_SITE_HOST=127.0.0.1 PUBLIC_SITE_PORT="$site_port"
export PUBLIC_SITE_BASE_URL="$site_base" API_PUBLIC_URL="$api_base" CLIENT_ORIGINS="$web_base"
export AUTH_EXPOSE_DEV_OTP=true AUTH_HASH_SECRET=website-e2e-secret BUSINESS_BUILDER_PUBLIC_APPS_ENABLED=true

node server/index.mjs >"$dir/api.log" 2>&1 & pids+=("$!")
# Same database file; started after the API so migrations have already run.
for _ in $(seq 1 40); do curl -sf "$api_base/api/health" >/dev/null && break; sleep 1; done
node server/public-site-server.mjs >"$dir/site.log" 2>&1 & pids+=("$!")
VITE_API_BASE_URL="$api_base" npx vite --host 127.0.0.1 --port "$web_port" --strictPort >"$dir/web.log" 2>&1 & pids+=("$!")

for _ in $(seq 1 60); do
  curl -sf "$api_base/api/health" >/dev/null && curl -s -o /dev/null "$site_base/" && curl -sf "$web_base/" >/dev/null && break
  sleep 1
done
args=("$@"); [ "${#args[@]}" -gt 0 ] || args=(e2e/websites/website-release-flow.spec.ts)
E2E_BASE_URL="$web_base" E2E_API_BASE_URL="$api_base" npx playwright test "${args[@]}" --project=chromium --workers=1 || { echo "--- api.log"; tail -20 "$dir/api.log"; echo "--- site.log"; tail -20 "$dir/site.log"; exit 1; }
