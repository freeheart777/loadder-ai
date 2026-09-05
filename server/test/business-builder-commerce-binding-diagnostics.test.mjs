import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceOutboxOperations } from "../app/business-builder/commerce-outbox-operations.mjs";

function setup(){
  const db=new Database(":memory:");
  db.exec(`
    CREATE TABLE site_projects(
      id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,site_type TEXT NOT NULL,
      slug TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL
    );
    CREATE TABLE business_builder_projects(
      id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,active_version_id TEXT
    );
    CREATE TABLE business_builder_commerce_bindings(
      id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_project_id TEXT NOT NULL,
      business_builder_project_id TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL
    );
  `);
  const site=db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,updated_at) VALUES(?,?,?,?,?,?,?)");
  site.run("s-unbound","w1","Published Unbound","STORE","published-unbound","PUBLISHED","2026-09-05T04:00:00.000Z");
  site.run("s-disabled","w1","Published Disabled","STORE","published-disabled","PUBLISHED","2026-09-05T03:00:00.000Z");
  site.run("s-active","w1","Published Active","STORE","published-active","PUBLISHED","2026-09-05T02:00:00.000Z");
  site.run("s-draft","w1","Draft Store","STORE","draft-store","DRAFT","2026-09-05T05:00:00.000Z");
  site.run("s-page","w1","Normal Site","WEBSITE","normal-site","PUBLISHED","2026-09-05T06:00:00.000Z");
  site.run("s-foreign","w2","Foreign Store","STORE","foreign-store","PUBLISHED","2026-09-05T07:00:00.000Z");
  const project=db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,status,active_version_id) VALUES(?,?,?,?,?)");
  project.run("p-disabled","w1","Disabled Commerce App","draft",null);
  project.run("p-active","w1","Live Commerce App","active","v-live");
  project.run("p-foreign","w2","Foreign App","active","v-foreign");
  const binding=db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,updated_at) VALUES(?,?,?,?,?,?)");
  binding.run("b-disabled","w1","s-disabled","p-disabled","disabled","2026-09-05T03:30:00.000Z");
  binding.run("b-active","w1","s-active","p-active","active","2026-09-05T02:30:00.000Z");
  binding.run("b-foreign","w2","s-foreign","p-foreign","active","2026-09-05T07:30:00.000Z");
  return db;
}

test("binding diagnostics identify actionable storefront problems without crossing workspace boundaries",()=>{
  const db=setup();
  try{
    runWithWorkspace("w1",()=>{
      const rows=new CommerceOutboxOperations(db).bindingDiagnostics();
      assert.equal(rows.length,4);
      assert.deepEqual(rows.map(row=>row.siteProjectId),["s-unbound","s-disabled","s-active","s-draft"]);
      assert.equal(rows.some(row=>row.siteProjectId==="s-foreign"),false);
      assert.equal(rows.some(row=>row.siteProjectId==="s-page"),false);

      const unbound=rows.find(row=>row.siteProjectId==="s-unbound");
      assert.equal(unbound.bindingState,"unbound");
      assert.equal(unbound.health,"critical");
      assert.equal(unbound.issue,"PUBLISHED_STORE_UNBOUND");
      assert.equal(unbound.businessBuilderProjectId,null);

      const disabled=rows.find(row=>row.siteProjectId==="s-disabled");
      assert.equal(disabled.bindingState,"disabled");
      assert.equal(disabled.health,"warning");
      assert.equal(disabled.issue,"PUBLISHED_STORE_BINDING_DISABLED");
      assert.equal(disabled.businessBuilderProjectName,"Disabled Commerce App");
      assert.equal(disabled.businessBuilderProjectStatus,"draft");

      const active=rows.find(row=>row.siteProjectId==="s-active");
      assert.equal(active.bindingState,"active");
      assert.equal(active.targetRunnable,true);
      assert.equal(active.businessBuilderActiveVersionId,"v-live");
      assert.equal(active.health,"healthy");
      assert.equal(active.issue,null);
      assert.equal(active.businessBuilderProjectName,"Live Commerce App");

      const draft=rows.find(row=>row.siteProjectId==="s-draft");
      assert.equal(draft.bindingState,"unbound");
      assert.equal(draft.health,"info");
      assert.equal(draft.issue,"DRAFT_STORE_UNBOUND");
    });
  }finally{db.close();}
});

test("binding diagnostics remain tenant scoped for another workspace and respect limit",()=>{
  const db=setup();
  try{
    runWithWorkspace("w2",()=>{
      const rows=new CommerceOutboxOperations(db).bindingDiagnostics({limit:1});
      assert.equal(rows.length,1);
      assert.equal(rows[0].siteProjectId,"s-foreign");
      assert.equal(rows[0].bindingState,"active");
      assert.equal(rows[0].targetRunnable,true);
      assert.equal(rows[0].health,"healthy");
      assert.equal(rows[0].businessBuilderProjectName,"Foreign App");
    });
  }finally{db.close();}
});
