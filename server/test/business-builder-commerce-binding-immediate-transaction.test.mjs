import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceBindingOperations } from "../app/business-builder/commerce-binding-operations.mjs";

function open(path) {
  const db = new Database(path);
  db.pragma("journal_mode=WAL");
  db.pragma("busy_timeout=25");
  return db;
}

function seed(db) {
  db.exec(`
    CREATE TABLE site_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,slug TEXT NOT NULL,status TEXT NOT NULL,site_type TEXT NOT NULL);
    CREATE TABLE business_builder_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,active_version_id TEXT,updated_at TEXT NOT NULL);
    CREATE TABLE business_builder_commerce_bindings(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_project_id TEXT NOT NULL,business_builder_project_id TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(workspace_id,site_project_id));
    CREATE TABLE business_builder_commerce_outbox(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_project_id TEXT NOT NULL,business_builder_project_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE audit_logs(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,metadata_json TEXT NOT NULL,created_at TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,slug,status,site_type) VALUES(?,?,?,?,?,?)").run("s1","w1","Store","store","PUBLISHED","STORE");
  const project = db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,status,active_version_id,updated_at) VALUES(?,?,?,?,?,?)");
  project.run("p1","w1","Old App","ready","v1","2026-09-05T00:00:00.000Z");
  project.run("p2","w1","New App","ready",null,"2026-09-05T00:00:00.000Z");
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run("b1","w1","s1","p1","active","seed","x","x");
}

test("binding remediation acquires an IMMEDIATE writer lock before validation decisions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "commerce-binding-lock-"));
  const path = join(dir, "binding.sqlite");
  const dbA = open(path);
  seed(dbA);
  const dbB = open(path);

  try {
    dbB.exec("BEGIN IMMEDIATE");
    dbB.prepare("UPDATE business_builder_projects SET active_version_id=? WHERE id='p2'").run("v2");

    runWithWorkspace("w1", () => {
      const operations = new CommerceBindingOperations(dbA);
      assert.throws(
        () => operations.setBinding("s1", { projectId: "p2", actorId: "admin", confirmRebind: true, reason: "move" }),
        (error) => error?.code === "SQLITE_BUSY",
      );
      assert.equal(operations.getBinding("s1").business_builder_project_id, "p1");
    });

    dbB.exec("COMMIT");

    runWithWorkspace("w1", () => {
      const operations = new CommerceBindingOperations(dbA);
      const result = operations.setBinding("s1", { projectId: "p2", actorId: "admin", confirmRebind: true, reason: "move" });
      assert.equal(result.ok, true);
      assert.equal(result.binding.business_builder_project_id, "p2");
    });
  } finally {
    if (dbB.inTransaction) dbB.exec("ROLLBACK");
    dbB.close();
    dbA.close();
    await rm(dir, { recursive: true, force: true });
  }
});
