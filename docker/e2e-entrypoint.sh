#!/bin/sh
# The frontend bundle calls the API at http://localhost:3001 and CORS allows http://localhost:5173,
# exactly as for a developer's host browser. Inside this container "localhost" is the test
# container, so forward those ports to the compose services. No test or app code changes.
set -eu
fwd() { socat "TCP-LISTEN:${1%%:*},fork,reuseaddr,bind=127.0.0.1" "TCP:$2" & }
# Default (D1 dev stack): the suites use http://localhost:5173 and :3001/:3002.
# E2E_FORWARDS="<port>=<host>:<port> ..." replaces that list (D2 topology: 80=web:80 so app.localhost
# and sites.localhost, which resolve to loopback, reach Caddy).
ports=""
if [ -n "${E2E_FORWARDS:-}" ]; then
  for spec in $E2E_FORWARDS; do fwd "${spec%%=*}" "${spec#*=}"; ports="$ports ${spec%%=*}"; done
else
  fwd 5173 web:5173; fwd 3001 server:3001; fwd 3002 server:3002; ports="5173 3001 3002"
fi
for port in $ports; do
  for _ in $(seq 1 20); do curl -s -o /dev/null "http://127.0.0.1:$port/" && break; sleep 0.5; done
done
exec "$@"
