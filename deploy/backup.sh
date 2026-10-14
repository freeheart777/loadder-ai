#!/usr/bin/env bash
# Consistent backup of a running deployment, no downtime:
#   deploy/backup.sh [backup-dir]            (default: deploy/backups, created 0700)
# Produces loadder-<UTC>.sqlite (SQLite online backup API, verified) and files-<UTC>.tgz (site media,
# medical documents, object storage). Streamed out of the containers, so no host-side permissions
# are involved. Take the DB first, then the files; a file written in between may be orphaned, never lost.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
dir="${1:-deploy/backups}"; umask 077; mkdir -p "$dir"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
db="$dir/loadder-$ts.sqlite"; files="$dir/files-$ts.tgz"
dc run --rm --no-deps -T --entrypoint sh server -c 'node scripts/backup-sqlite.mjs /tmp/backup.sqlite >&2 && cat /tmp/backup.sqlite' > "$db"
dc run --rm --no-deps -T --entrypoint tar server czf - -C /data site-media medical-private object-storage > "$files"
[ -s "$db" ] && [ -s "$files" ] || { rm -f "$db" "$files"; echo "backup failed" >&2; exit 1; }
echo "database: $db ($(wc -c < "$db") bytes)"
echo "files:    $files ($(wc -c < "$files") bytes)"
echo "Copy both off this server. A backup that has never been restored is not verified."
