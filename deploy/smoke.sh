#!/usr/bin/env bash
# Post-deploy smoke test for the production edge (read-only: GET/HEAD only, never sends an SMS).
#   deploy/smoke.sh <app-host> <sites-host> [--cacert <ca.pem>] [--resolve-local]
# --resolve-local maps both hosts to 127.0.0.1 (for *.localhost validation with Caddy's internal CA).
set -uo pipefail
app="${1:?usage: smoke.sh <app-host> <sites-host> [--cacert file] [--resolve-local]}"; sites="${2:?sites host}"; shift 2
args=(-s --max-time 15)
while [ $# -gt 0 ]; do
  case "$1" in
    --cacert) args+=(--cacert "$2"); shift 2 ;;
    --resolve-local) for h in "$app" "$sites"; do for p in 80 443; do args+=(--resolve "$h:$p:127.0.0.1"); done; done; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
fail=0
check() { # name, condition-result(0/1), detail
  if [ "$2" -eq 0 ]; then printf 'PASS  %s\n' "$1"; else printf 'FAIL  %s  (%s)\n' "$1" "$3"; fail=1; fi
}
get() { curl "${args[@]}" "$@"; }

code=$(get -o /dev/null -w '%{http_code}' "https://$app/");                          check "app origin serves the SPA over TLS" $([ "$code" = 200 ] && echo 0 || echo 1) "got $code"
code=$(get -o /dev/null -w '%{http_code}' "https://$app/dashboard/websites");        check "SPA fallback for a deep link" $([ "$code" = 200 ] && echo 0 || echo 1) "got $code"
code=$(get -o /dev/null -w '%{http_code}' "http://$app/");                           check "HTTP redirects to HTTPS" $([ "$code" = 301 ] || [ "$code" = 308 ] && echo 0 || echo 1) "got $code"
asset=$(get "https://$app/" | grep -o '/assets/[^"]*\.js' | head -1)
hdr=$(get -D - -o /dev/null "https://$app$asset" | tr -d '\r');                      check "hashed asset is cached as immutable" $(echo "$hdr" | grep -qi 'cache-control:.*immutable' && echo 0 || echo 1) "headers: $(echo "$hdr" | grep -i cache-control)"
hdr=$(get -D - -o /dev/null "https://$app/" | tr -d '\r');                           check "index.html is not cached" $(echo "$hdr" | grep -qi 'cache-control:.*no-cache' && echo 0 || echo 1) "headers: $(echo "$hdr" | grep -i cache-control)"
check "HSTS present" $(echo "$hdr" | grep -qi '^strict-transport-security' && echo 0 || echo 1) "missing"
check "X-Content-Type-Options present" $(echo "$hdr" | grep -qi '^x-content-type-options: nosniff' && echo 0 || echo 1) "missing"
check "no Server header leaked" $(echo "$hdr" | grep -qi '^server:' && echo 1 || echo 0) "Server header present"
health=$(get "https://$app/api/health")
check "API reachable on the app origin (production mode)" $(echo "$health" | grep -q '"environment":"production"' && echo 0 || echo 1) "health: ${health:0:120}"
status=$(get "https://$app/api/auth/status")
check "development OTP is not exposed" $(echo "$status" | grep -q '"developmentOtpExposed":false' && echo 0 || echo 1) "status: ${status:0:160}"
echo "INFO  otpDelivery: $(echo "$status" | grep -o '"otpDelivery":"[^"]*"')  (must be \"configured\" for operators to sign in)"
code=$(get -o /dev/null -w '%{http_code}' "https://$app/api/site-projects");         check "protected API rejects anonymous callers" $([ "$code" = 401 ] && echo 0 || echo 1) "got $code"
code=$(get -o /dev/null -w '%{http_code}' "https://$sites/sites/none");              check "sites origin serves the public-site runtime" $([ "$code" = 404 ] && echo 0 || echo 1) "got $code"
code=$(get -o /dev/null -w '%{http_code}' "https://$sites/api/health");              check "sites origin does NOT expose the API" $([ "$code" = 404 ] && echo 0 || echo 1) "got $code"
exit $fail
