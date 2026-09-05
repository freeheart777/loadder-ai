import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceBindingOperations } from "../app/business-builder/commerce-binding-operations.mjs";

function setup({withAudit=true}={}){
  const db=new Database(":memory:");
  db.exec(`
    CREATE TABLE site_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,slug TEXT NOT NULL,status TEXT NOT NULL,site_type TEXT NOT NULL);
    CREATE TABLE business_builder_projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,active_version_id TEXT,updated_at TEXT NOT NULL);
    CREATE TABLE business_builder_commerce_bindings(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,site_project_id TEXT NOT NULL,business_builder_project_id TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(workspace_id,site_project_id));
  `);
  if(withAudit)db.exec(`CREATE TABLE audit_logs(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,metadata_json TEXT NOT NULL,created_at TEXT NOT NULL);`);
  const site=db.prepare("INSERT INTO site_projects(id,workspace_id,name,slug,status,site_type) VALUES(?,?,?,?,?,?)");
  site.run("s1","w1","Store One","store-one","PUBLISHED","STORE");
  site.run("s2","w1","Store Two","store-two","PUBLISHED","STORE");
  site.run("page1","w1","Website","website","PUBLISHED","WEBSITE");
  site.run("s9","w2","Foreign Store","foreign","PUBLISHED","STORE");
  const project=db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,status,active_version_id,updated_at) VALUES(?,?,?,?,?,?)");
  project.run("p-ready","w1","Ready App","ready","v1","2026-09-05T03:00:00.000Z");
  project.run("p-draft","w1","Draft Runnable","draft","v2","2026-09-05T02:00:00.000Z");
  project.run("p-empty","w1","No Active Version","draft",null,"2026-09-05T04:00:00.000Z");
  project.run("p-archived","w1","Archived App","archived","v3","2026-09-05T05:00:00.000Z");
  project.run("p-foreign","w2","Foreign App","ready","v9","2026-09-05T06:00:00.000Z");
  return db;
}

function bind(db,{id="b1",site="s1",project="p-ready",status="active"}={}){
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(id,"w1",site,project,status,"seed","2026-09-05T01:00:00.000Z","2026-09-05T01:00:00.000Z");
}

test("binding targets exclude archived apps and identify runnable active-version targets",()=>{
  const db=setup();
  try{runWithWorkspace("w1",()=>{
    const targets=new CommerceBindingOperations(db).targets();
    assert.deepEqual(targets.map(target=>target.id),["p-ready","p-draft","p-empty"]);
    assert.equal(targets.find(target=>target.id==="p-ready").eligible,true);
    assert.equal(targets.find(target=>target.id==="p-draft").eligible,true);
    assert.equal(targets.find(target=>target.id==="p-empty").eligible,false);
    assert.equal(targets.some(target=>target.id==="p-archived"),false);
    assert.equal(targets.some(target=>target.id==="p-foreign"),false);
  });}finally{db.close();}
});

test("unbound Store can be bound only to a runnable same-workspace project and is audited",()=>{
  const db=setup();
  try{runWithWorkspace("w1",()=>{
    const operations=new CommerceBindingOperations(db);
    assert.equal(operations.setBinding("page1",{projectId:"p-ready",actorId:"admin"}).code,"COMMERCE_STORE_NOT_FOUND");
    assert.equal(operations.setBinding("s1",{projectId:"p-foreign",actorId:"admin"}).code,"COMMERCE_BINDING_TARGET_NOT_FOUND");
    assert.equal(operations.setBinding("s1",{projectId:"p-empty",actorId:"admin"}).code,"COMMERCE_BINDING_TARGET_NOT_RUNNABLE");
    assert.equal(operations.getBinding("s1"),null);

    const result=operations.setBinding("s1",{projectId:"p-ready",actorId:"admin"});
    assert.equal(result.ok,true);
    assert.equal(result.changed,true);
    assert.equal(result.action,"commerce_binding.create");
    assert.equal(result.binding.business_builder_project_id,"p-ready");
    assert.equal(result.binding.status,"active");
    const audit=db.prepare("SELECT action,user_id,metadata_json FROM audit_logs").get();
    assert.equal(audit.action,"commerce_binding.create");
    assert.equal(audit.user_id,"admin");
    const metadata=JSON.parse(audit.metadata_json);
    assert.equal(metadata.siteProjectId,"s1");
    assert.equal(metadata.fromProjectId,null);
    assert.equal(metadata.toProjectId,"p-ready");
  });}finally{db.close();}
});

test("disabled binding to the same target can be re-enabled without risky rebind confirmation",()=>{
  const db=setup();bind(db,{status:"disabled"});
  try{runWithWorkspace("w1",()=>{
    const result=new CommerceBindingOperations(db).setBinding("s1",{projectId:"p-ready",actorId:"admin"});
    assert.equal(result.ok,true);
    assert.equal(result.action,"commerce_binding.enable");
    assert.equal(result.binding.status,"active");
    assert.equal(db.prepare("SELECT action FROM audit_logs").get().action,"commerce_binding.enable");
  });}finally{db.close();}
});

test("changing an existing binding target requires explicit confirmation and an operator reason",()=>{
  const db=setup();bind(db);
  try{runWithWorkspace("w1",()=>{
    const operations=new CommerceBindingOperations(db);
    const before=operations.getBinding("s1");
    const withoutConfirm=operations.setBinding("s1",{projectId:"p-draft",actorId:"admin",reason:"move"});
    assert.equal(withoutConfirm.code,"COMMERCE_BINDING_REBIND_CONFIRMATION_REQUIRED");
    assert.equal(operations.getBinding("s1").business_builder_project_id,before.business_builder_project_id);

    const withoutReason=operations.setBinding("s1",{projectId:"p-draft",actorId:"admin",confirmRebind:true,reason:"   "});
    assert.equal(withoutReason.code,"COMMERCE_BINDING_REBIND_REASON_REQUIRED");
    assert.equal(operations.getBinding("s1").business_builder_project_id,"p-ready");

    const rebound=operations.setBinding("s1",{projectId:"p-draft",actorId:"admin",confirmRebind:true,reason:"Switch to the rebuilt commerce app"});
    assert.equal(rebound.ok,true);
    assert.equal(rebound.action,"commerce_binding.rebind");
    assert.equal(rebound.binding.business_builder_project_id,"p-draft");
    const audit=db.prepare("SELECT action,metadata_json FROM audit_logs").get();
    assert.equal(audit.action,"commerce_binding.rebind");
    const metadata=JSON.parse(audit.metadata_json);
    assert.equal(metadata.fromProjectId,"p-ready");
    assert.equal(metadata.toProjectId,"p-draft");
    assert.equal(metadata.reason,"Switch to the rebuilt commerce app");
  });}finally{db.close();}
});

test("active binding to the same target is an idempotent no-op",()=>{
  const db=setup();bind(db);
  try{runWithWorkspace("w1",()=>{
    const result=new CommerceBindingOperations(db).setBinding("s1",{projectId:"p-ready",actorId:"admin"});
    assert.equal(result.ok,true);
    assert.equal(result.changed,false);
    assert.equal(result.code,"COMMERCE_BINDING_ALREADY_ACTIVE");
    assert.equal(db.prepare("SELECT COUNT(*) c FROM audit_logs").get().c,0);
  });}finally{db.close();}
});

test("binding mutation rolls back when authenticated audit persistence fails",()=>{
  const db=setup({withAudit:false});
  try{runWithWorkspace("w1",()=>{
    const operations=new CommerceBindingOperations(db);
    assert.throws(()=>operations.setBinding("s1",{projectId:"p-ready",actorId:"admin"}),/no such table: audit_logs/);
    assert.equal(operations.getBinding("s1"),null);
  });}finally{db.close();}
});
