import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBusinessBuilderAdminHealth } from "../app/business-builder/admin-health.mjs";
import { CommerceOutboxOperations } from "../app/business-builder/commerce-outbox-operations.mjs";

function setup(){
  const db=new Database(":memory:");
  db.exec(`
    CREATE TABLE site_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,site_type TEXT NOT NULL,slug TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE business_builder_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,active_version_id TEXT);
    CREATE TABLE business_builder_commerce_bindings(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_project_id TEXT NOT NULL,business_builder_project_id TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL);
  `);
  const site=db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,updated_at) VALUES(?,?,?,?,?,?,?)");
  site.run("s-no-version","w1","No Version Store","STORE","no-version","PUBLISHED","2026-09-05T06:00:00.000Z");
  site.run("s-archived","w1","Archived Target Store","STORE","archived-target","PUBLISHED","2026-09-05T05:00:00.000Z");
  site.run("s-healthy","w1","Healthy Store","STORE","healthy","PUBLISHED","2026-09-05T04:00:00.000Z");
  site.run("s-draft","w1","Draft Store","STORE","draft","DRAFT","2026-09-05T03:00:00.000Z");
  site.run("s-foreign","w2","Foreign Store","STORE","foreign","PUBLISHED","2026-09-05T07:00:00.000Z");
  const project=db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,status,active_version_id) VALUES(?,?,?,?,?)");
  project.run("p-no-version","w1","No Version App","ready",null);
  project.run("p-archived","w1","Archived App","archived","v-old");
  project.run("p-healthy","w1","Healthy App","ready","v-live");
  project.run("p-draft-broken","w1","Draft Broken App","ready",null);
  project.run("p-foreign","w2","Foreign App","ready",null);
  const binding=db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,updated_at) VALUES(?,?,?,?,?,?)");
  binding.run("b-no-version","w1","s-no-version","p-no-version","active","2026-09-05T06:30:00.000Z");
  binding.run("b-archived","w1","s-archived","p-archived","active","2026-09-05T05:30:00.000Z");
  binding.run("b-healthy","w1","s-healthy","p-healthy","active","2026-09-05T04:30:00.000Z");
  binding.run("b-draft","w1","s-draft","p-draft-broken","active","2026-09-05T03:30:00.000Z");
  binding.run("b-foreign","w2","s-foreign","p-foreign","active","2026-09-05T07:30:00.000Z");
  return db;
}

test("published active bindings with archived or versionless targets are high-severity health incidents",()=>{
  const db=setup();
  try{runWithWorkspace("w1",()=>{
    const health=createBusinessBuilderAdminHealth(db).summary();
    assert.equal(health.counters.commercePublishedStoresTargetUnrunnable,2);
    assert.equal(health.status,"degraded");
    assert.deepEqual(health.incidents.filter(item=>item.code==="COMMERCE_STOREFRONT_TARGET_UNRUNNABLE"),[
      {code:"COMMERCE_STOREFRONT_TARGET_UNRUNNABLE",severity:"high",count:2},
    ]);
  });}finally{db.close();}
});

test("binding diagnostics identify unrunnable targets without flagging healthy or draft stores as published incidents",()=>{
  const db=setup();
  try{runWithWorkspace("w1",()=>{
    const rows=new CommerceOutboxOperations(db).bindingDiagnostics();
    const noVersion=rows.find(row=>row.siteProjectId==="s-no-version");
    assert.equal(noVersion.bindingState,"active");
    assert.equal(noVersion.targetRunnable,false);
    assert.equal(noVersion.businessBuilderActiveVersionId,null);
    assert.equal(noVersion.health,"critical");
    assert.equal(noVersion.issue,"PUBLISHED_STORE_TARGET_UNRUNNABLE");

    const archived=rows.find(row=>row.siteProjectId==="s-archived");
    assert.equal(archived.targetRunnable,false);
    assert.equal(archived.businessBuilderProjectStatus,"archived");
    assert.equal(archived.health,"critical");
    assert.equal(archived.issue,"PUBLISHED_STORE_TARGET_UNRUNNABLE");

    const healthy=rows.find(row=>row.siteProjectId==="s-healthy");
    assert.equal(healthy.targetRunnable,true);
    assert.equal(healthy.businessBuilderActiveVersionId,"v-live");
    assert.equal(healthy.health,"healthy");
    assert.equal(healthy.issue,null);

    const draft=rows.find(row=>row.siteProjectId==="s-draft");
    assert.equal(draft.targetRunnable,false);
    assert.equal(draft.health,"info");
    assert.equal(draft.issue,"STORE_TARGET_UNRUNNABLE");
    assert.equal(rows.some(row=>row.siteProjectId==="s-foreign"),false);
  });}finally{db.close();}
});
