import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";

export function createSiteTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE business_context_versions(id TEXT PRIMARY KEY, workspace_id TEXT, status TEXT, snapshot_json TEXT);
    CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, status TEXT, role TEXT);
    CREATE TABLE decision_records(id TEXT PRIMARY KEY, workspace_id TEXT, context_version_id TEXT, decision_type TEXT, supersedes_decision_id TEXT);
    CREATE TABLE marketing_campaigns(id TEXT PRIMARY KEY, workspace_id TEXT);
    CREATE TABLE customers(
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id),
      name TEXT NOT NULL DEFAULT 'Test Customer'
    );
  `);
  db.prepare("INSERT INTO workspaces(id) VALUES (?), (?)").run("ws-1", "ws-2");
  db.prepare("INSERT INTO business_context_versions(id) VALUES (?)").run("ctx-1");
  // Later evidence rebuilds require the real event and experiment owner tables.
  runMigrations(db, migrations.filter((migration) => [14, 38].includes(migration.version) || migration.version >= 42));
  return db;
}
