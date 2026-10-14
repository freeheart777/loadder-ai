#!/bin/sh
# Create the runtime locations under /data, then hand over to the command (the supervisor).
# The database is never seeded from the repository; an empty volume is initialised by the
# migration step (scripts/migrate.mjs) and the application's own schema.
set -eu
mkdir -p /data/db /data/site-media /data/medical-private /data/object-storage
chmod 700 /data/medical-private
exec "$@"
