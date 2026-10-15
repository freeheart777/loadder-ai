#!/usr/bin/env bash
# Medical documents acceptance in PRODUCTION mode (isolated project "loadder-meddocs", fresh volumes):
# real TLS through Caddy, real ClamAV (amd64 image, emulated on arm64), encrypted local storage, SMS delivered
# to a TLS mock. Needs deploy/.env.production (local values are fine), Node on the host, free ports 80/443.
#   deploy/medical-docs-check.sh
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . deploy/.env.production; set +a
export LOADDER_VERSION="${LOADDER_VERSION:-local}"
certs="$(mktemp -d)"; export SMS_MOCK_CERTS="$certs"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -keyout "$certs/key.pem" -out "$certs/cert.pem" -subj "/CN=api.kavenegar.com" \
  -addext "subjectAltName=DNS:api.kavenegar.com" -addext "basicConstraints=critical,CA:TRUE" >/dev/null 2>&1 || { echo "openssl failed" >&2; exit 2; }
chmod 644 "$certs"/*.pem
# The feature is enabled for this run only; nothing is written to deploy/.env.production.
export MEDICAL_DOCUMENTS_ENABLED=true CLAMAV_HOST=clamav MEDICAL_DOCUMENT_ENCRYPTION_KEY="$(openssl rand -hex 32)"
export LOADDER_PROJECT=loadder-meddocs
FILES="deploy/compose.prod.yaml deploy/compose.smsmock.yaml deploy/compose.meddocs-test.yaml"
export LOADDER_COMPOSE_EXTRA="-f deploy/compose.smsmock.yaml -f deploy/compose.meddocs-test.yaml --profile medical-docs"
dc() { docker compose -p "$LOADDER_PROJECT" --env-file deploy/.env.production -f deploy/compose.prod.yaml $LOADDER_COMPOSE_EXTRA "$@"; }
cleanup() { [ -n "${KEEP_STACK:-}" ] && { echo "KEEP_STACK set: leaving project $LOADDER_PROJECT running"; return; }; dc down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf "$certs" /tmp/meddocs-root.crt; }
trap cleanup EXIT
dc down -v --remove-orphans >/dev/null 2>&1
dc up -d --build >/dev/null 2>&1 || { echo "stack failed to start" >&2; dc logs --tail 30 >&2; exit 1; }
for _ in $(seq 1 120); do [ "$(dc ps --format '{{.Service}}={{.Health}}' | grep -c healthy)" -ge 3 ] && break; sleep 3; done
docker cp "$(dc ps -q web):/data/caddy/pki/authorities/local/root.crt" /tmp/meddocs-root.crt 2>/dev/null
APP="$LOADDER_APP_HOST" SITES="$LOADDER_SITES_HOST" CA=/tmp/meddocs-root.crt PROJECT="$LOADDER_PROJECT" ENVFILE=deploy/.env.production \
  FILES="deploy/compose.prod.yaml deploy/compose.smsmock.yaml deploy/compose.meddocs-test.yaml" node deploy/test/medical-docs-flow.mjs
