import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration080GrowthEvidenceLinks as migration } from "../db/migrations/080_growth_evidence_links.mjs";
import { createGrowthEvidenceRepository } from "../app/repositories/growth-evidence-repository.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { normalizeEvidenceLink } from "../app/growth/evidence-contract.mjs";

// Minimal owner-table fixtures: no production DB/import or provider calls.
function fixture(t) {
  const db = new Database(":memory:"); t.after(() => db.close());
  db.pragma("foreign_keys=ON");
  db.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,snapshot_json TEXT);
    CREATE TABLE marketing_campaigns(id TEXT PRIMARY KEY,workspace_id TEXT);
    CREATE TABLE experiments(id TEXT PRIMARY KEY,workspace_id TEXT,context_version_id TEXT);
    CREATE TABLE business_events(id TEXT PRIMARY KEY,workspace_id TEXT,event_type TEXT);
    CREATE TABLE ecommerce_orders(id TEXT PRIMARY KEY,workspace_id TEXT,site_project_id TEXT,total_minor INTEGER,currency TEXT,payment_reference TEXT,payment_status TEXT);
    CREATE TABLE ecommerce_financial_ledger(id TEXT PRIMARY KEY,workspace_id TEXT,site_project_id TEXT,order_id TEXT,source_type TEXT,source_id TEXT,entry_type TEXT,amount_minor INTEGER,currency TEXT);`);
  for (const w of ["a", "b"]) {
    db.prepare("INSERT INTO workspaces VALUES(?)").run(w);
    db.prepare("INSERT INTO business_context_versions VALUES(?,?,?,?)").run(`ctx-${w}`,w,"archived",JSON.stringify({strategy:{goals:["Grow enquiries"]}}));
    db.prepare("INSERT INTO marketing_campaigns VALUES(?,?)").run(`campaign-${w}`,w);
    db.prepare("INSERT INTO experiments VALUES(?,?,?)").run(`experiment-${w}`,w,`ctx-${w}`);
    db.prepare("INSERT INTO business_events VALUES(?,?,?)").run(`event-${w}`,w,"lead.converted");
    db.prepare("INSERT INTO ecommerce_orders VALUES(?,?,?,?,?,?,?)").run(`order-${w}`,w,`site-${w}`,100,"IRR","receipt","PAID");
    db.prepare("INSERT INTO ecommerce_financial_ledger VALUES(?,?,?,?,?,?,?,?,?)").run(`ledger-${w}`,w,`site-${w}`,`order-${w}`,"ORDER_PAYMENT",`order-${w}`,"PAYMENT_CAPTURED",100,"IRR");
  }
  const before = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
  migration.up(db); migration.up(db);
  const repo = createGrowthEvidenceRepository(db,{now:()=>new Date("2026-09-07T12:00:00Z")});
  return {db,repo,before,create: input => runWithWorkspace("a",()=>repo.create({...payload(),...input}))};
}
const payload = () => ({contractVersion:1,contextVersionId:"ctx-a",goal:{reference:"/strategy/goals/0",version:"ctx-a"},subject:{type:"EXPERIMENT",id:"experiment-a"},relation:"HAS_EVIDENCE",object:{type:"EVENT",id:"event-a"},evidenceKind:"REPORTED_CONVERSION",producer:"crm",source:"domain-event",sourceEventId:"event-a",correlationId:"journey",causationId:"cause",idempotencyKey:"one"});

test("same-tenant link pins legacy goal/context/experiment without changing owner records",t=>{
  const f=fixture(t),r=f.create().link;
  assert.equal(r.workspace_id,"a"); assert.equal(r.authority_class,"REPORTED"); assert.equal(r.goal_version,"ctx-a");
  assert.equal(f.create({subject:{type:"CAMPAIGN",id:"campaign-a"},idempotencyKey:"campaign"}).link.subject_type,"CAMPAIGN");
  assert.equal(f.db.prepare("SELECT count(*) n FROM experiments").get().n,2);
});
test("migration adds exactly one table, is idempotent and preserves existing schemas",t=>{
  const f=fixture(t); const after=f.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
  assert.deepEqual(after.filter(x=>x.name!=="growth_evidence_links"),f.before); assert.equal(after.length,f.before.length+1);
  assert.deepEqual(f.db.pragma("foreign_key_check"),[]);
});
test("tenant is required and client authority/tenant/time/hash fields are rejected",t=>{
  const f=fixture(t); assert.throws(()=>f.repo.create(payload()),/Workspace context/);
  for(const field of ["workspaceId","authorityClass","recordedAt","payloadHash"]) assert.throws(()=>f.create({[field]:"forged"}),/GROWTH_CONTRACT_INVALID/);
});
test("foreign subject/object/context/event are rejected",t=>{
  const f=fixture(t);
  for(const patch of [{subject:{type:"EXPERIMENT",id:"experiment-b"}},{subject:{type:"CAMPAIGN",id:"campaign-b"}},{object:{type:"EVENT",id:"event-b"}},{sourceEventId:"event-b"},{contextVersionId:"ctx-b",goal:{reference:"/strategy/goals/0",version:"ctx-b"}}]) assert.throws(()=>f.create(patch),/GROWTH_(REFERENCE_NOT_FOUND|CONTEXT_NOT_FOUND|CONTEXT_MISMATCH)/);
  assert.equal(runWithWorkspace("b",()=>f.repo.get(f.create().link.id)),null);
});
test("unknown/malformed types, versions, relations and goal references fail closed",t=>{
  const f=fixture(t);
  for(const patch of [{subject:{type:"ANY",id:"x"}},{object:{type:"PAYMENT",id:"x"}},{relation:"BECOMES"},{contractVersion:2},{goal:{reference:"/strategy/goals/00",version:"ctx-a"}},{goal:{reference:"/strategy/goals/0",version:"new"}}]) assert.throws(()=>f.create(patch),/GROWTH_CONTRACT_INVALID/);
  assert.throws(()=>f.create({goal:{reference:"/strategy/goals/9",version:"ctx-a"}}),/GROWTH_GOAL_NOT_FOUND/);
});
test("normalized replay converges; conflicting replay fails",t=>{
  const f=fixture(t),first=f.create();
  const replay=f.create({producer:" crm "}); assert.equal(replay.duplicate,true); assert.equal(replay.link.id,first.link.id);
  for(const patch of [{source:"other"},{evidenceKind:"CRM_CONVERSION"},{object:null},{correlationId:"other"}]) assert.throws(()=>f.create(patch),/GROWTH_IDEMPOTENCY_CONFLICT/);
  assert.equal(f.db.prepare("SELECT count(*) n FROM growth_evidence_links").get().n,1);
});
test("all absent outcome kinds remain UNKNOWN",t=>{
  const f=fixture(t);
  for(const evidenceKind of ["REPORTED_CONVERSION","CRM_CONVERSION","ORDER","PAYMENT","VERIFIED_REVENUE","ATTRIBUTED_REVENUE","CAUSAL_LIFT"]) assert.equal(f.create({object:null,evidenceKind,idempotencyKey:evidenceKind}).link.authority_class,"UNKNOWN");
});
test("reported and CRM events cannot become financial authority",t=>{
  const f=fixture(t);
  for(const evidenceKind of ["PAYMENT","VERIFIED_REVENUE"]) assert.throws(()=>f.create({evidenceKind,producer:"verified-payment-provider"}),/GROWTH_FINANCIAL_EVIDENCE_REQUIRED/);
  assert.equal(f.create({evidenceKind:"CRM_CONVERSION"}).link.authority_class,"REPORTED");
});
test("financial outcomes resolve canonical capture and linked order",t=>{
  const f=fixture(t);
  for(const evidenceKind of ["PAYMENT","VERIFIED_REVENUE"]) assert.equal(f.create({object:{type:"FINANCIAL_ENTRY",id:"ledger-a"},evidenceKind,idempotencyKey:evidenceKind}).link.authority_class,"CANONICAL_RECORD");
  assert.throws(()=>f.create({object:{type:"ORDER",id:"order-a"},evidenceKind:"PAYMENT"}),/GROWTH_FINANCIAL_EVIDENCE_REQUIRED/);
  assert.throws(()=>f.create({object:{type:"FINANCIAL_ENTRY",id:"ledger-b"},evidenceKind:"PAYMENT"}),/GROWTH_REFERENCE_NOT_FOUND/);
});
test("unverified or mismatched financial evidence fails closed",t=>{
  const f=fixture(t),p={object:{type:"FINANCIAL_ENTRY",id:"ledger-a"},evidenceKind:"VERIFIED_REVENUE"};
  f.db.exec("UPDATE ecommerce_orders SET payment_reference=NULL WHERE id='order-a'"); assert.throws(()=>f.create(p),/GROWTH_FINANCIAL_EVIDENCE_REQUIRED/);
  f.db.exec("UPDATE ecommerce_orders SET payment_reference='receipt',total_minor=200 WHERE id='order-a'"); assert.throws(()=>f.create(p),/GROWTH_FINANCIAL_EVIDENCE_REQUIRED/);
});
test("attribution and causal lift stay reported, never inferred from a payment",t=>{
  const f=fixture(t);
  for(const evidenceKind of ["ATTRIBUTED_REVENUE","CAUSAL_LIFT"]) {
    assert.equal(f.create({evidenceKind,idempotencyKey:evidenceKind}).link.authority_class,"REPORTED");
    assert.throws(()=>f.create({object:{type:"FINANCIAL_ENTRY",id:"ledger-a"},evidenceKind,idempotencyKey:`bad-${evidenceKind}`}),/GROWTH_EVIDENCE_KIND_MISMATCH/);
  }
});
test("successor chain preserves original and rejects competing successors",t=>{
  const f=fixture(t),a=f.create().link;
  const b=f.create({supersedesId:a.id,idempotencyKey:"two",object:null}).link;
  const c=f.create({supersedesId:b.id,idempotencyKey:"three"}).link;
  assert.equal(c.supersedes_id,b.id); assert.equal(runWithWorkspace("a",()=>f.repo.get(a.id)).object_id,"event-a");
  assert.throws(()=>f.create({supersedesId:a.id,idempotencyKey:"four"}),/GROWTH_SUCCESSOR_CONFLICT/);
});
test("corrections cannot cross kind, subject, tenant or time",t=>{
  const f=fixture(t),a=f.create().link;
  for(const patch of [{evidenceKind:"CRM_CONVERSION"},{subject:{type:"CAMPAIGN",id:"campaign-a"}},{supersedesId:"missing"}]) assert.throws(()=>f.create({supersedesId:a.id,idempotencyKey:"next",...patch}),/GROWTH_PREDECESSOR_MISMATCH/);
  const earlier=createGrowthEvidenceRepository(f.db,{now:()=>new Date("2026-09-06")});
  assert.throws(()=>runWithWorkspace("a",()=>earlier.create({...payload(),idempotencyKey:"early",supersedesId:a.id})),/GROWTH_PREDECESSOR_MISMATCH/);
});
test("database rejects update/delete and foreign references even bypassing repository",t=>{
  const f=fixture(t),a=f.create().link;
  assert.throws(()=>f.db.prepare("UPDATE growth_evidence_links SET source='x' WHERE id=?").run(a.id),/immutable/);
  assert.throws(()=>f.db.prepare("DELETE FROM growth_evidence_links WHERE id=?").run(a.id),/append-only/);
  const clone={...a,id:"bad",idempotency_key:"bad",object_id:"event-b"};
  const columns=Object.keys(clone); const insert=f.db.prepare(`INSERT INTO growth_evidence_links(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);
  assert.throws(()=>insert.run(...Object.values(clone)),/growth object mismatch/);
  assert.throws(()=>insert.run(...Object.values({...clone,object_id:"event-a",evidence_kind:"VERIFIED_REVENUE",authority_class:"CANONICAL_RECORD"})),/financial evidence/);
});
test("contract normalization is deterministic regardless of input key order",()=>{
  assert.deepEqual(normalizeEvidenceLink(payload()),normalizeEvidenceLink(Object.fromEntries(Object.entries(payload()).reverse())));
});

test("stored hash and original evidence survive database serialization/reopen",t=>{
  const f=fixture(t),original=f.create().link;
  const restored=new Database(f.db.serialize()); t.after(()=>restored.close());
  const repo=createGrowthEvidenceRepository(restored);
  const replay=runWithWorkspace("a",()=>repo.create(payload()));
  assert.equal(replay.duplicate,true); assert.deepEqual(replay.link,original);
});

test("foreign predecessor and database competing successor fail closed",t=>{
  const f=fixture(t),a=f.create().link;
  const foreign={...payload(),contextVersionId:"ctx-b",goal:{reference:"/strategy/goals/0",version:"ctx-b"},subject:{type:"EXPERIMENT",id:"experiment-b"},object:{type:"EVENT",id:"event-b"},sourceEventId:"event-b",supersedesId:a.id};
  assert.throws(()=>runWithWorkspace("b",()=>f.repo.create(foreign)),/GROWTH_PREDECESSOR_MISMATCH/);
  const b=f.create({supersedesId:a.id,idempotencyKey:"two"}).link;
  const columns=Object.keys(b), clone={...b,id:"another",idempotency_key:"another"};
  assert.throws(()=>f.db.prepare(`INSERT INTO growth_evidence_links(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...Object.values(clone)),/UNIQUE constraint failed/);
});
