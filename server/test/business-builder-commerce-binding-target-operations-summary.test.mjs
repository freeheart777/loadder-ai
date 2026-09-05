import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration051BusinessBuilderRuntimeRecords } from "../db/migrations/051_business_builder_runtime_records.mjs";
import { migration052BusinessBuilderActionLedger } from "../db/migrations/052_business_builder_action_ledger.mjs";
import { migration054BusinessBuilderDeploymentHistory } from "../db/migrations/054_business_builder_deployment_history.mjs";
import { createOperationsDashboardService } from "../app/business-builder/operations-dashboard.mjs";

test("operations summary counts published stores bound to unrunnable targets",()=>{
  const db=new Database(":memory:");
  for(const migration of [migration001Identity,migration050BusinessBuilderProjects,migration051BusinessBuilderRuntimeRecords,migration052BusinessBuilderActionLedger,migration054BusinessBuilderDeploymentHistory]) migration.up(db);
  db.exec(`
    CREATE TABLE site_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_type TEXT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE business_builder_commerce_bindings(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_project_id TEXT NOT NULL,business_builder_project_id TEXT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE business_builder_commerce_outbox(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,business_builder_project_id TEXT,status TEXT NOT NULL,last_error TEXT,dead_lettered_at TEXT,claim_token TEXT,claim_expires_at TEXT);
  `);
  db.prepare("INSERT INTO users(id,mobile,name,status,created_at,updated_at) VALUES('u1','1','A','active','x','x')").run();
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES('w1','W1','w1','active','x','x')").run();
  db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status,created_at,updated_at) VALUES('m1','w1','u1','owner','active','x','x')").run();
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,active_version_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?)").run(
    'p-broken','w1','Broken','commerce','fa-IR','ready',null,'x','x',
    'p-good','w1','Good','commerce','fa-IR','ready','v1','x','x',
  );
  db.prepare("INSERT INTO site_projects(id,workspace_id,site_type,status) VALUES('s-broken','w1','STORE','PUBLISHED'),('s-good','w1','STORE','PUBLISHED')").run();
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status) VALUES('b1','w1','s-broken','p-broken','active'),('b2','w1','s-good','p-good','active')").run();

  try{
    runWithWorkspace('w1',()=>{
      const summary=createOperationsDashboardService(db).workspaceSummary();
      assert.equal(summary.commerceBindings.active,2);
      assert.equal(summary.commerceBindings.publishedTargetUnrunnable,1);
      assert.equal(summary.commerceBindings.publishedUnbound,0);
      assert.equal(summary.commerceBindings.publishedDisabled,0);
    });
  }finally{db.close();}
});
