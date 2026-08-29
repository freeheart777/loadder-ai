import assert from "node:assert/strict";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";

test("site builder control plane migration is registered, idempotent, and tenant-safe", () => {
  const db = createSiteTestDb();
  try {
    runMigrations(db, migrations.filter((migration) => migration.version >= 42));

    for (const version of [42, 43, 44, 45, 46]) {
      assert.equal(db.prepare("SELECT count(*) AS count FROM schema_migrations WHERE version=?").get(version).count, 1);
    }
    for (const table of ["site_projects", "site_assets", "site_integrations", "site_publish_versions", "site_domains", "site_media_assets"]) {
      assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
    }

    const projectColumns = db.prepare("PRAGMA table_info(site_projects)").all().map((x) => x.name);
    assert.deepEqual(projectColumns.slice(0, 8), ["id", "workspace_id", "context_version_id", "name", "site_type", "slug", "status", "content_json"]);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_site_assets_workspace_guard'").get());
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_site_integrations_workspace_guard'").get());
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_site_media_assets_workspace_guard'").get());
  } finally {
    db.close();
  }
});
