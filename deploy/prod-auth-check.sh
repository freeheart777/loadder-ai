#!/usr/bin/env bash
# Production-mode authentication acceptance (isolated project "loadder-prodtest", fresh volumes):
# real TLS through Caddy, NODE_ENV=production, SMS delivered to a TLS mock that impersonates the real
# provider URL. Needs deploy/.env.production (values may be local, e.g. *.localhost) and free ports 80/443.
#   deploy/prod-auth-check.sh
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . deploy/.env.production; set +a
APP="$LOADDER_APP_HOST"; SITES="$LOADDER_SITES_HOST"
export LOADDER_VERSION="${LOADDER_VERSION:-local}"
certs="$(mktemp -d)"; export SMS_MOCK_CERTS="$certs"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -keyout "$certs/key.pem" -out "$certs/cert.pem" -subj "/CN=api.kavenegar.com" \
  -addext "subjectAltName=DNS:api.kavenegar.com" -addext "basicConstraints=critical,CA:TRUE" >/dev/null 2>&1 || { echo "openssl failed" >&2; exit 2; }
chmod 644 "$certs"/*.pem
export LOADDER_PROJECT=loadder-prodtest LOADDER_COMPOSE_EXTRA="-f deploy/compose.smsmock.yaml"
dc() { docker compose -p loadder-prodtest --env-file deploy/.env.production -f deploy/compose.prod.yaml -f deploy/compose.smsmock.yaml "$@"; }
cleanup() { dc down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf "$certs" "$jar" /tmp/prodtest-root.crt; }
jar="$(mktemp)"; trap cleanup EXIT
fail=0; check() { if [ "$2" -eq 0 ]; then echo "PASS  $1"; else echo "FAIL  $1  ($3)"; fail=1; fi; }

dc down -v --remove-orphans >/dev/null 2>&1
dc up -d --build >/dev/null 2>&1 || { echo "stack failed to start" >&2; dc logs --tail 30 >&2; exit 1; }
for _ in $(seq 1 60); do [ "$(dc ps --format '{{.Service}}={{.Health}}' | grep -c healthy)" -ge 2 ] && break; sleep 3; done
docker cp "$(dc ps -q web):/data/caddy/pki/authorities/local/root.crt" /tmp/prodtest-root.crt 2>/dev/null
cu() { curl -s --max-time 20 --cacert /tmp/prodtest-root.crt --resolve "$APP:443:127.0.0.1" --resolve "$SITES:443:127.0.0.1" "$@"; }
sms() { dc logs sms-mock --no-color 2>/dev/null | grep '^sms-mock-1' | sed 's/^[^|]*| //' | grep "receptor"; }

echo "== edge smoke"; bash deploy/smoke.sh "$APP" "$SITES" --cacert /tmp/prodtest-root.crt --resolve-local | sed 's/^/   /'
st=$(cu "https://$APP/api/auth/status"); check "OTP delivery reports configured" $(echo "$st" | grep -q '"otpDelivery":"configured"' && echo 0 || echo 1) "$st"

echo "== sign-in over TLS"
M=09125550101
resp=$(cu -X POST -H 'content-type: application/json' -d "{\"mobile\":\"$M\",\"name\":\"Prod Operator\"}" -w '\n%{http_code}' "https://$APP/api/auth/send-otp")
code=${resp##*$'\n'}; body=${resp%$'\n'*}
check "send-otp succeeds" $([ "$code" = 200 ] && echo 0 || echo 1) "status $code"
check "response carries no code" $(echo "$body" | grep -qiE 'developmentOtp|[0-9]{5}' && echo 1 || echo 0) "$body"
sleep 1; otp=$(sms | grep "\"receptor\":\"$M\"" | tail -1 | grep -o '[0-9]\{5\}' | tail -1)
check "the SMS provider received the code" $([ -n "$otp" ] && echo 0 || echo 1) "no message for $M"
hdrs=$(cu -D - -o /tmp/prodtest-verify.json -c "$jar" -X POST -H 'content-type: application/json' -d "{\"mobile\":\"$M\",\"code\":\"$otp\"}" "https://$APP/api/auth/verify-otp" | tr -d '\r')
check "verify-otp signs in" $(echo "$hdrs" | head -1 | grep -q ' 200' && echo 0 || echo 1) "$(echo "$hdrs" | head -1)"
cookie=$(echo "$hdrs" | grep -i '^set-cookie:')
check "session cookie is Secure, HttpOnly, SameSite=Lax" $(echo "$cookie" | grep -qi 'secure' && echo "$cookie" | grep -qi 'httponly' && echo "$cookie" | grep -qi 'samesite=lax' && echo 0 || echo 1) "$cookie"
check "session cookie is host-only (no Domain)" $(echo "$cookie" | grep -qi 'domain=' && echo 1 || echo 0) "$cookie"
check "session works on the app origin" $([ "$(cu -b "$jar" -o /dev/null -w '%{http_code}' "https://$APP/api/auth/me")" = 200 ] && echo 0 || echo 1) "/api/auth/me"
check "protected API without the cookie is 401" $([ "$(cu -o /dev/null -w '%{http_code}' "https://$APP/api/site-projects")" = 401 ] && echo 0 || echo 1) "anonymous"

echo "== website creation and publishing on the sites origin"
site=$(cu -b "$jar" -X POST -H 'content-type: application/json' -d '{"name":"Prod Clinic","siteType":"MEDICAL","content":{}}' "https://$APP/api/site-projects" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "operator creates a site" $([ -n "$site" ] && echo 0 || echo 1) "no id"
check "operator publishes it" $([ "$(cu -b "$jar" -X POST -o /dev/null -w '%{http_code}' "https://$APP/api/site-projects/$site/publish")" = 200 ] && echo 0 || echo 1) "publish"
shdr=$(cu -D - -o /tmp/prodtest-site.html "https://$SITES/sites/$site" | tr -d '\r')
check "published site renders on the sites origin" $(echo "$shdr" | head -1 | grep -q ' 200' && echo 0 || echo 1) "$(echo "$shdr" | head -1)"
check "published page is script-free (CSP script-src none)" $(echo "$shdr" | grep -qi "content-security-policy:.*script-src 'none'" && echo 0 || echo 1) "no CSP"
check "sites origin never sets or needs the session cookie" $(echo "$shdr" | grep -qi '^set-cookie' && echo 1 || echo 0) "set-cookie present"

echo "== provider outage fails closed"
M2=09129999999
resp=$(cu -X POST -H 'content-type: application/json' -d "{\"mobile\":\"$M2\",\"name\":\"Outage Op\"}" -w '\n%{http_code}' "https://$APP/api/auth/send-otp")
code=${resp##*$'\n'}; body=${resp%$'\n'*}
check "outage returns 503 OTP_DELIVERY_FAILED" $([ "$code" = 503 ] && echo "$body" | grep -q OTP_DELIVERY_FAILED && echo 0 || echo 1) "$code $body"
check "outage response leaks nothing" $(echo "$body" | grep -qiE 'kavenegar|mock-key|[0-9]{5}|provider' && echo 1 || echo 0) "$body"
sleep 2; lost=$(sms | grep "\"receptor\":\"$M2\"" | tail -1 | sed 's/.*"message":"//' | grep -o '[0-9]\{5\}' | tail -1)
vcode=$(cu -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d "{\"mobile\":\"$M2\",\"code\":\"${lost:-00000}\"}" "https://$APP/api/auth/verify-otp")
check "the provider was asked to send a code (then failed)" $([ -n "$lost" ] && echo 0 || echo 1) "no message logged for $M2"
check "the undelivered code cannot sign anyone in" $([ "$vcode" = 400 ] && echo 0 || echo 1) "verify returned '$vcode'"
check "no secret or code in server logs" $(dc logs server --no-color 2>&1 | grep -qE "mock-key|$otp|${lost:-NOLOST}" && echo 1 || echo 0) "found in logs"

echo "== restart persistence"
dc restart server >/dev/null 2>&1
for _ in $(seq 1 40); do [ "$(dc ps --format '{{.Service}}={{.Health}}' | grep -c 'server=healthy')" -ge 1 ] && break; sleep 3; done
check "session survives a server restart" $([ "$(cu -b "$jar" -o /dev/null -w '%{http_code}' "https://$APP/api/auth/me")" = 200 ] && echo 0 || echo 1) "/api/auth/me after restart"
check "published site survives a server restart" $([ "$(cu -o /dev/null -w '%{http_code}' "https://$SITES/sites/$site")" = 200 ] && echo 0 || echo 1) "site after restart"

echo "== backup and restore round trip"
bdir="$(mktemp -d)"
bash deploy/backup.sh "$bdir" >/tmp/prodtest-backup.log 2>&1; bstatus=$?
dbf=$(ls "$bdir"/loadder-*.sqlite 2>/dev/null | head -1); ff=$(ls "$bdir"/files-*.tgz 2>/dev/null | head -1)
check "backup completes with a database and a files archive" $([ "$bstatus" -eq 0 ] && [ -s "$dbf" ] && [ -s "$ff" ] && echo 0 || echo 1) "$(tail -3 /tmp/prodtest-backup.log)"
check "the database backup is a SQLite file" $(head -c 15 "$dbf" 2>/dev/null | grep -q 'SQLite format 3' && echo 0 || echo 1) "bad header"
site2=$(cu -b "$jar" -X POST -H 'content-type: application/json' -d '{"name":"Created After Backup","siteType":"MEDICAL","content":{}}' "https://$APP/api/site-projects" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
cu -b "$jar" -X POST -o /dev/null "https://$APP/api/site-projects/$site2/publish"
check "a site created after the backup is live" $([ "$(cu -o /dev/null -w '%{http_code}' "https://$SITES/sites/$site2")" = 200 ] && echo 0 || echo 1) "site2"
bash deploy/restore.sh "$dbf" "$ff" --yes --no-pre-backup >/tmp/prodtest-restore.log 2>&1; rstatus=$?
check "restore completes and verifies the database" $([ "$rstatus" -eq 0 ] && grep -q 'integrity: ok' /tmp/prodtest-restore.log && echo 0 || echo 1) "$(tail -3 /tmp/prodtest-restore.log)"
check "the original site is back after restore" $([ "$(cu -o /dev/null -w '%{http_code}' "https://$SITES/sites/$site")" = 200 ] && echo 0 || echo 1) "site after restore"
check "the post-backup site is gone (state rolled back)" $([ "$(cu -o /dev/null -w '%{http_code}' "https://$SITES/sites/$site2")" = 404 ] && echo 0 || echo 1) "site2 after restore"
check "the operator session from the backup is valid again" $([ "$(cu -b "$jar" -o /dev/null -w '%{http_code}' "https://$APP/api/auth/me")" = 200 ] && echo 0 || echo 1) "session after restore"
rm -rf "$bdir"

echo; [ "$fail" -eq 0 ] && echo "PRODUCTION AUTH CHECK: ALL PASSED" || echo "PRODUCTION AUTH CHECK: FAILURES"
exit "$fail"
