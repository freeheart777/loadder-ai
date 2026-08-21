import { migrations } from "./migrations/index.mjs";

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
