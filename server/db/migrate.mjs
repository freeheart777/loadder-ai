import { migrations } from "./migrations/index.mjs";
import path from "node:path";
import { createSqliteBackup } from "../app/persistence/sqlite-backup.mjs";

export function runMigrations(db, migrationList = migrations) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => row.version)
  );
  const pending = migrationList.filter((migration) => !appliedVersions.has(migration.version));
  if (process.env.NODE_ENV === "production" && pending.length) {
    if (process.env.LOADDER_ALLOW_PRODUCTION_MIGRATIONS !== "true") throw new Error("PERSISTENCE_PRODUCTION_MIGRATION_APPROVAL_REQUIRED");
    createSqliteBackup({ db, databasePath: path.resolve(process.env.DATABASE_PATH || ""), backupDirectory: path.resolve(process.env.LOADDER_BACKUP_DIR || ""), publicDirectories: [process.env.LANDING_STATIC_DIRECTORY, process.env.PUBLIC_STATIC_DIRECTORY].filter(Boolean) });
  }

  const applyMigration = db.transaction((migration) => {
    migration.up(db);
    db.prepare(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (?, ?, ?)
    `).run(
      migration.version,
      migration.name,
      new Date().toISOString()
    );
  });

  for (const migration of [...migrationList].sort(
    (a, b) => a.version - b.version
  )) {
    if (!appliedVersions.has(migration.version)) {
      applyMigration(migration);
    }
  }

  return db
    .prepare(`
      SELECT version, name, applied_at AS appliedAt
      FROM schema_migrations
      ORDER BY version
    `)
    .all();
}
