import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";

export function createSiteTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE business_context_versions(id TEXT PRIMARY KEY);
    CREATE TABLE customers(
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id),
      name TEXT NOT NULL DEFAULT 'Test Customer'
    );
  `);
  db.prepare("INSERT INTO workspaces(id) VALUES (?), (?)").run("ws-1", "ws-2");
  db.prepare("INSERT INTO business_context_versions(id) VALUES (?)").run("ctx-1");
  // Later experiment extensions require the real pre-42 owner table.
  runMigrations(db, migrations.filter((migration) => migration.version === 38 || migration.version >= 42));
  return db;
}
