#!/usr/bin/env bash
# Restore a backup made by deploy/backup.sh. REPLACES all application data.
#   deploy/restore.sh <loadder-*.sqlite> <files-*.tgz> --yes [--no-pre-backup]
# Stops the web and server containers, replaces the database and files in the data volume, verifies the
# restored database (integrity_check), then starts the stack again (migrations run before the API).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
db="${1:?usage: restore.sh <db.sqlite> <files.tgz> --yes}"; files="${2:?files archive}"; shift 2
yes=0; pre=1
for a in "$@"; do case "$a" in --yes) yes=1 ;; --no-pre-backup) pre=0 ;; *) echo "unknown option $a" >&2; exit 2 ;; esac; done
[ "$yes" -eq 1 ] || { echo "This replaces ALL application data. Re-run with --yes to proceed." >&2; exit 2; }
[ -s "$db" ] && [ -s "$files" ] || { echo "backup files missing or empty" >&2; exit 2; }
[ "$pre" -eq 0 ] || { echo "Taking a safety backup of the current state first..."; bash deploy/backup.sh deploy/backups/pre-restore; }
dc stop web server >/dev/null
dc run --rm --no-deps -T --entrypoint sh server -c 'rm -f /data/db/loadder.sqlite /data/db/loadder.sqlite-wal /data/db/loadder.sqlite-shm && cat > /data/db/loadder.sqlite' < "$db"
dc run --rm --no-deps -T --entrypoint sh server -c 'rm -rf /data/site-media /data/medical-private /data/object-storage && tar xzf - -C /data && mkdir -p /data/site-media /data/medical-private /data/object-storage && chmod 700 /data/medical-private' < "$files"
dc run --rm --no-deps --entrypoint node server -e "const D=require('better-sqlite3');const d=new D(process.env.DATABASE_PATH,{readonly:true});const r=d.pragma('integrity_check',{simple:true});if(r!=='ok'){console.error('restored database failed integrity_check: '+r);process.exit(1)}console.log('restored database integrity: ok')"
dc up -d >/dev/null
wait_healthy server 180 && echo "Restore complete: server healthy." || { echo "server did not become healthy; check: docker compose logs server" >&2; exit 1; }
