import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import express from "express";
import request from "supertest";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration057BusinessBuilderAppUsers } from "../db/migrations/057_business_builder_app_users.mjs";
import { createPublicBusinessAppRouter } from "../app/business-builder/public-app-router.mjs";

// This regression intentionally omits commerce migrations 069/073. Public app bootstrap
// must remain usable for legacy/non-commerce app fixtures even when the authenticated
// principal has the customer role.
test("customer public bootstrap remains compatible when commerce binding schema is absent", async () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migration001Identity.up(db);
  migration050BusinessBuilderProjects.up(db);
  migration057BusinessBuilderAppUsers.up(db);

  const now = "2026-09-05T10:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,created_at,updated_at) VALUES('w1','W','w',?,?)").run(now,now);
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,locale,status,created_at,updated_at) VALUES('p1','w1','App','fa-IR','ready',?,?)").run(now,now);
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_builder_project_versions(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      definition_json TEXT NOT NULL,
      ui_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  db.prepare("INSERT INTO business_builder_project_versions(id,workspace_id,project_id,version_number,definition_json,ui_json,created_at) VALUES('v1','w1','p1',1,?,?,?)")
    .run(JSON.stringify({id:"app1",name:"App",vertical:"generic",locale:"fa-IR",entities:[],workflows:[],accessPolicy:{defaultRole:"public"}}),JSON.stringify({pages:[]}),now);
  db.prepare("UPDATE business_builder_projects SET active_version_id='v1' WHERE id='p1'").run();

  db.prepare("INSERT INTO business_builder_app_users(id,workspace_id,project_id,email,display_name,role,status,created_at,updated_at) VALUES('u1','w1','p1','buyer@example.com','Buyer','customer','active',?,?)").run(now,now);

  // create session directly so this fixture stays focused on bootstrap compatibility.
  const token = "legacy-commerce-free-token";
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("INSERT INTO business_builder_app_sessions(id,workspace_id,project_id,app_user_id,token_hash,expires_at,created_at) VALUES('s1','w1','p1','u1',?,?,?)")
    .run(hash,"2099-01-01T00:00:00.000Z",now);

  const app = express();
  app.use(createPublicBusinessAppRouter({db}));
  const response = await request(app).get("/public/apps/p1/bootstrap").set("X-Loadder-App-Token", token);
  assert.equal(response.status,200);
  assert.equal(response.body.success,true);
  assert.deepEqual(response.body.commerceStores,[]);
});
