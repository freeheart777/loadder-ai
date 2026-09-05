import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceOutboxOperations } from "../app/business-builder/commerce-outbox-operations.mjs";

function setup(){
  const db=new Database(":memory:");
  db.exec(`
    CREATE TABLE business_builder_commerce_outbox(
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, business_builder_project_id TEXT NOT NULL,
      event_id TEXT NOT NULL, event_type TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, available_at TEXT NOT NULL,
      delivered_at TEXT, dead_lettered_at TEXT, dead_letter_reason TEXT, requeue_count INTEGER NOT NULL DEFAULT 0,
      claim_token TEXT, claimed_at TEXT, claim_expires_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE business_builder_commerce_event_receipts(
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT NOT NULL,
      event_id TEXT NOT NULL, consumer TEXT NOT NULL, status TEXT NOT NULL, details_json TEXT, processed_at TEXT
    );
    CREATE TABLE audit_logs(
      id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, action TEXT NOT NULL,
      resource_type TEXT NOT NULL, resource_id TEXT, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  const insert=db.prepare("INSERT INTO business_builder_commerce_outbox(id,workspace_id,business_builder_project_id,event_id,event_type,payload_json,status,attempts,last_error,available_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  insert.run("ob1","w1","p1","evt1","commerce.payment.captured","{}","pending",1,"timeout","2099-01-01T00:00:00.000Z","2026-09-05T00:00:00.000Z");
  insert.run("ob2","w2","p2","evt2","commerce.order.created","{}","pending",0,null,"2026-09-05T00:00:00.000Z","2026-09-05T00:00:00.000Z");
  const audit=db.prepare("INSERT INTO audit_logs(id,workspace_id,user_id,action,resource_type,resource_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)");
  audit.run("a1","w1","admin-1","commerce_outbox.retry","business_builder_commerce_outbox","ob1",JSON.stringify({eventId:"evt1",beforeState:"retrying",reason:"first"}),"2026-09-05T01:00:00.000Z");
  audit.run("a2","w1","admin-2","commerce_outbox.requeue","business_builder_commerce_outbox","ob1",JSON.stringify({eventId:"evt1",beforeState:"dead_letter",reason:"second"}),"2026-09-05T02:00:00.000Z");
  audit.run("a3","w2","admin-9","commerce_outbox.retry","business_builder_commerce_outbox","ob2",JSON.stringify({eventId:"evt2"}),"2026-09-05T03:00:00.000Z");
  audit.run("a4","w1","admin-3","other.action","other_resource","x",JSON.stringify({secret:"ignore"}),"2026-09-05T04:00:00.000Z");
  return db;
}

test("recovery history is workspace scoped, commerce-only, newest first, and filterable by outbox id",()=>{
  const db=setup();
  try{
    runWithWorkspace("w1",()=>{
      const operations=new CommerceOutboxOperations(db);
      const all=operations.recoveryHistory();
      assert.equal(all.length,2);
      assert.deepEqual(all.map(row=>row.id),["a2","a1"]);
      assert.deepEqual(all.map(row=>row.actorId),["admin-2","admin-1"]);
      assert.equal(all.some(row=>row.outboxId==="ob2"),false);
      assert.equal(all.some(row=>row.action==="other.action"),false);
      const filtered=operations.recoveryHistory({outboxId:"ob1",limit:1});
      assert.equal(filtered.length,1);
      assert.equal(filtered[0].id,"a2");
      assert.equal(filtered[0].metadata.reason,"second");
    });
    runWithWorkspace("w2",()=>{
      const history=new CommerceOutboxOperations(db).recoveryHistory();
      assert.equal(history.length,1);
      assert.equal(history[0].id,"a3");
    });
  }finally{db.close();}
});

test("reconciliation embeds only the selected event recovery history",()=>{
  const db=setup();
  try{
    runWithWorkspace("w1",()=>{
      const reconciliation=new CommerceOutboxOperations(db).reconcile("ob1");
      assert.equal(reconciliation.recoveryHistory.length,2);
      assert.deepEqual(reconciliation.recoveryHistory.map(row=>row.outboxId),["ob1","ob1"]);
      assert.equal(reconciliation.recoveryHistory.some(row=>row.metadata?.secret),false);
    });
  }finally{db.close();}
});
