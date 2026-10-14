#!/bin/sh
# Create every runtime location under /data, then hand over to the canonical supervisor.
# The database is NOT seeded: an empty volume is initialised by the application's own schema and migrations.
set -eu
mkdir -p /data/db /data/site-media /data/medical-private /data/object-storage
exec "$@"
