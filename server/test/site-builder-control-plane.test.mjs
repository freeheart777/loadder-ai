import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

import { migrations } from "../db/migrations/index.mjs";
import { runMigrations } from "../db/migrate.mjs";

test("site builder control plane migration is registered, idempotent, and tenant-safe", () => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-site-builder-"));
  const db = new Database(join(directory, "site-builder.sqlite"));
  db.pragma("foreign_keys = ON");

  try {
    runMigrations(db, migrations);
    runMigrations(db, migrations);

    assert.equal(db.prepare("SELECT count(*) AS count FROM schema_migrations WHERE version=42").get().count, 1);
    for (const table of ["site_projects", "site_assets", "site_integrations"]) {
      assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
    }

    const projectColumns = db.prepare("PRAGMA table_info(site_projects)").all().map((x) => x.name);
    assert.deepEqual(projectColumns.slice(0, 8), ["id", "workspace_id", "context_version_id", "name", "site_type", "slug", "status", "content_json"]);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_site_assets_workspace_guard'").get());
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_site_integrations_workspace_guard'").get());
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
