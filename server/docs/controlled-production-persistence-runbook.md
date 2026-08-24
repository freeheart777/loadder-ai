# Controlled Production Persistence Runbook

Loadder's controlled launch uses exactly one writable backend instance, one explicit persistent local volume, SQLite, and explicit Website/Landing artifact directories. Multiple writable replicas are unsupported.

Configure absolute, non-temporary paths with `DATABASE_PATH`, `LANDING_STATIC_DIRECTORY`, `PUBLIC_STATIC_DIRECTORY`, and `LOADDER_BACKUP_DIR`. The backup directory must remain outside every public artifact directory. Keep `LOADDER_INSTANCE_COUNT=1`. Set `LOADDER_PERSISTENCE_VALIDATED=true` only after the deployed volume survives restart and redeploy drills.

Before deployment, run `npm run persistence:preflight`. Before applying pending production migrations, create a validated backup with `npm run persistence:backup`; then set `LOADDER_ALLOW_PRODUCTION_MIGRATIONS=true` for that controlled deployment. Startup refuses pending production migrations without approval and refuses to migrate if its automatic pre-migration backup fails.

For a restore drill, stop the application, retain the current database, and run `node server/scripts/restore-database.mjs /absolute/backup.sqlite /absolute/new-target.sqlite CHECKSUM`. The command requires distinct explicit paths and validates checksum, integrity, foreign keys, and migrations before and after restoration. Point a staging process at the restored target and smoke test it before any production recovery decision.

Back up before every deploy/migration and at an operator-selected interval such as daily. RPO depends on that interval; RTO depends on the manual restore and deployment process. Store backups on protected non-public storage with deployment-level disk encryption and off-host retention as appropriate.

SQLite revisions are canonical. Static Website/Landing artifacts are deterministic and rebuildable from immutable revisions, but their configured directories must still live on persistent storage for normal operation. A real launch remains pending until database and artifacts survive actual restart/redeploy and a staging restore succeeds on the selected hosting volume.
