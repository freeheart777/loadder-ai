import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration076CommerceBindingTargetInvariants } from "../db/migrations/076_commerce_binding_target_invariants.mjs";

function setup(){
  const db=new Database(":memory:");
  db.exec(`
    CREATE TABLE site_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_type TEXT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE business_builder_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,status TEXT NOT NULL,active_version_id TEXT,name TEXT);
    CREATE TABLE business_builder_commerce_bindings(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_project_id TEXT NOT NULL,business_builder_project_id TEXT NOT NULL,status TEXT NOT NULL);
  `);
  migration076CommerceBindingTargetInvariants.up(db);
  const site=db.prepare("INSERT INTO site_projects(id,workspace_id,site_type,status) VALUES(?,?,?,?)");
  site.run("s-live","w1","STORE","PUBLISHED");
  site.run("s-draft","w1","STORE","DRAFT");
  const project=db.prepare("INSERT INTO business_builder_projects(id,workspace_id,status,active_version_id,name) VALUES(?,?,?,?,?)");
  project.run("p-live","w1","ready","v1","Live Target");
  project.run("p-next","w1","ready","v2","Next Target");
  project.run("p-draft-target","w1","ready","v3","Draft Target");
  const binding=db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status) VALUES(?,?,?,?,?)");
  binding.run("b-live","w1","s-live","p-live","active");
  binding.run("b-draft","w1","s-draft","p-draft-target","active");
  return db;
}

test("published Store binding prevents target archive active-version removal and deletion",()=>{
  const db=setup();
  try{
    assert.throws(()=>db.prepare("UPDATE business_builder_projects SET active_version_id=NULL WHERE id='p-live'").run(),/commerce target active version required while published storefront bound/);
    assert.throws(()=>db.prepare("UPDATE business_builder_projects SET status='archived' WHERE id='p-live'").run(),/commerce target cannot be archived while published storefront bound/);
    assert.throws(()=>db.prepare("DELETE FROM business_builder_projects WHERE id='p-live'").run(),/commerce target cannot be deleted while published storefront bound/);
    assert.deepEqual(db.prepare("SELECT status,active_version_id FROM business_builder_projects WHERE id='p-live'").get(),{status:"ready",active_version_id:"v1"});
  }finally{db.close();}
});

test("non-destructive target updates remain allowed while published Store is bound",()=>{
  const db=setup();
  try{
    db.prepare("UPDATE business_builder_projects SET name='Renamed',active_version_id='v1-next' WHERE id='p-live'").run();
    assert.deepEqual(db.prepare("SELECT name,active_version_id FROM business_builder_projects WHERE id='p-live'").get(),{name:"Renamed",active_version_id:"v1-next"});
  }finally{db.close();}
});

test("after safe rebind the previous target can be archived or deleted",()=>{
  const db=setup();
  try{
    db.prepare("UPDATE business_builder_commerce_bindings SET business_builder_project_id='p-next' WHERE id='b-live'").run();
    db.prepare("UPDATE business_builder_projects SET status='archived',active_version_id=NULL WHERE id='p-live'").run();
    db.prepare("DELETE FROM business_builder_projects WHERE id='p-live'").run();
    assert.equal(db.prepare("SELECT COUNT(*) c FROM business_builder_projects WHERE id='p-live'").get().c,0);
  }finally{db.close();}
});

test("draft Store bindings do not block target lifecycle",()=>{
  const db=setup();
  try{
    db.prepare("UPDATE business_builder_projects SET status='archived',active_version_id=NULL WHERE id='p-draft-target'").run();
    db.prepare("DELETE FROM business_builder_projects WHERE id='p-draft-target'").run();
    assert.equal(db.prepare("SELECT COUNT(*) c FROM business_builder_projects WHERE id='p-draft-target'").get().c,0);
  }finally{db.close();}
});

test("disabled binding does not block target lifecycle",()=>{
  const db=setup();
  try{
    db.prepare("UPDATE business_builder_commerce_bindings SET status='disabled' WHERE id='b-live'").run();
    db.prepare("UPDATE business_builder_projects SET status='archived',active_version_id=NULL WHERE id='p-live'").run();
    assert.deepEqual(db.prepare("SELECT status,active_version_id FROM business_builder_projects WHERE id='p-live'").get(),{status:"archived",active_version_id:null});
  }finally{db.close();}
});
