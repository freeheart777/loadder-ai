// Explicit one-shot migration step for deployments: apply every pending migration, then exit.
// It uses the application's own runner (db/migrate.mjs) against DATABASE_PATH, so a failed migration
// stops the rollout before the API starts serving. Idempotent: running it again applies nothing.
import { db } from "../db/database.mjs";
import { runMigrations } from "../db/migrate.mjs";

try {
  const before = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()
    ? db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n : 0;
  const applied = runMigrations(db);
  db.pragma("wal_checkpoint(TRUNCATE)");
  console.log(`Migrations: ${applied.length} recorded (${applied.length - before} applied now), latest ${applied.at(-1)?.version} ${applied.at(-1)?.name}`);
  db.close();
} catch (error) {
  console.error("Migration failed:", error?.message || error);
  process.exit(1);
}
