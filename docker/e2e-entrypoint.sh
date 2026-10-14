#!/bin/sh
# The frontend bundle calls the API at http://localhost:3001 and CORS allows http://localhost:5173,
# exactly as for a developer's host browser. Inside this container "localhost" is the test
# container, so forward those ports to the compose services. No test or app code changes.
set -eu
fwd() { socat "TCP-LISTEN:$1,fork,reuseaddr,bind=127.0.0.1" "TCP:$2:$1" & }
fwd 5173 web; fwd 3001 server; fwd 3002 server
for port in 5173 3001 3002; do
  for _ in $(seq 1 20); do curl -s -o /dev/null "http://127.0.0.1:$port/" && break; sleep 0.5; done
done
exec "$@"
