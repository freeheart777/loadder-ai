import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import { migration084GrowthCopilotRuns as migration } from '../db/migrations/084_growth_copilot_runs.mjs';
import { runMigrations } from '../db/migrate.mjs';
import { createGrowthCopilotRepository } from '../app/repositories/growth-copilot-repository.mjs';
import { createGrowthCopilotRouter } from '../app/routes/growth-copilot.mjs';
import { COPILOT_CAPABILITIES } from '../app/growth/copilot-contract.mjs';
import { CRM_GROWTH_SOURCE } from '../app/growth/crm-evidence-contract.mjs';
import { runWithWorkspace } from '../app/tenant-context.mjs';

const actor={userId:'user-a'},time='2026-09-08T12:00:00.000Z';
const input=(patch={})=>({capability:'PREPARE_NEXT_EXPERIMENT_DRAFT',experimentId:'exp-a',contextVersionId:'ctx-a',goalRef:'/strategy/goals/0',candidateId:'candidate-a',idempotencyKey:'one',...patch});
function fixture(t) {
  const db=new Database(':memory:'); t.after(()=>db.close()); db.pragma('foreign_keys=ON');
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,status TEXT,role TEXT);
    CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,snapshot_json TEXT);
    CREATE TABLE experiments(id TEXT PRIMARY KEY,workspace_id TEXT,goal_contract_version INTEGER,goal_context_version_id TEXT,goal_ref TEXT);
    CREATE TABLE growth_content_briefs(id TEXT PRIMARY KEY,workspace_id TEXT,experiment_id TEXT,goal_context_version_id TEXT,goal_ref TEXT);
    CREATE TABLE growth_content_candidates(id TEXT PRIMARY KEY,workspace_id TEXT,brief_id TEXT,state TEXT,body TEXT);
    CREATE TABLE growth_evidence_links(id TEXT PRIMARY KEY,workspace_id TEXT,subject_type TEXT,subject_id TEXT,object_id TEXT,object_type TEXT,evidence_kind TEXT,context_version_id TEXT,goal_reference TEXT,recorded_at TEXT,supersedes_id TEXT);
    CREATE INDEX idx_growth_evidence_subject ON growth_evidence_links(workspace_id,subject_type,subject_id,recorded_at,id);
    CREATE UNIQUE INDEX idx_growth_evidence_successor ON growth_evidence_links(supersedes_id) WHERE supersedes_id IS NOT NULL;
    CREATE TABLE business_events(id TEXT PRIMARY KEY,workspace_id TEXT,source_type TEXT,event_type TEXT,context_version_id TEXT,subject_type TEXT,subject_id TEXT,customer_id TEXT,metadata_json TEXT,properties_json TEXT);
    CREATE TABLE leads(id TEXT PRIMARY KEY,workspace_id TEXT,customer_id TEXT,status TEXT,name TEXT,company TEXT,phone TEXT,updated_at TEXT);
    CREATE TABLE customers(id TEXT PRIMARY KEY,workspace_id TEXT);
    CREATE TABLE ecommerce_financial_ledger(id TEXT PRIMARY KEY,amount INTEGER);
    INSERT INTO ecommerce_financial_ledger VALUES('unchanged',123);`);
  for(const ws of ['a','b']) {
    db.prepare('INSERT INTO users VALUES(?)').run('user-'+ws);
    db.prepare('INSERT INTO workspaces VALUES(?)').run(ws);
    db.prepare('INSERT INTO workspace_memberships VALUES(?,?,?,?,?)').run(ws,ws,'user-'+ws,'active','owner');
    db.prepare('INSERT INTO business_context_versions VALUES(?,?,?,?)').run('ctx-'+ws,ws,'active',JSON.stringify({strategy:{goals:['More leads']}}));
    db.prepare('INSERT INTO experiments VALUES(?,?,1,?,?)').run('exp-'+ws,ws,'ctx-'+ws,'/strategy/goals/0');
    db.prepare('INSERT INTO growth_content_briefs VALUES(?,?,?,?,?)').run('brief-'+ws,ws,'exp-'+ws,'ctx-'+ws,'/strategy/goals/0');
    db.prepare('INSERT INTO growth_content_candidates VALUES(?,?,?,?,?)').run('candidate-'+ws,ws,'brief-'+ws,'APPROVED','Private content body');
  }
  runMigrations(db,[migration]);
  const state={contextVersionId:'ctx-a',isStale:false};
  const options={currentContextState:()=>state,now:()=>new Date(time)};
  const repository=createGrowthCopilotRepository(db,options),within=fn=>runWithWorkspace('a',fn);
  const prepare=(patch={})=>within(()=>repository.prepare(input(patch),actor));
  const count=()=>db.prepare('SELECT count(*) n FROM growth_copilot_runs').get().n;
  const fact=(id='fact',source=CRM_GROWTH_SOURCE)=>{
    db.prepare('INSERT OR IGNORE INTO customers VALUES(?,?)').run('customer','a');
    db.prepare('INSERT OR IGNORE INTO leads(id,workspace_id,customer_id,status) VALUES(?,?,?,?)').run('lead','a','customer','converted');
    db.prepare('INSERT INTO business_events VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'a',source,'lead.converted','ctx-a','lead','lead','customer',JSON.stringify({growth:{candidateId:'candidate-a',experimentId:'exp-a',goalRef:'/strategy/goals/0'}}),JSON.stringify({customerId:'customer'}));
    db.prepare('INSERT INTO growth_evidence_links VALUES(?,?,?,?,?,?,?,?,?,?,NULL)').run(id,'a','CONTENT_CANDIDATE','candidate-a',id,'EVENT','CRM_CONVERSION','ctx-a','/strategy/goals/0',time);
  };
  return {db,state,options,repository,within,prepare,count,fact};
}
test('all four authorized capabilities persist final bounded reference receipts',t=>{
  const f=fixture(t);
  for(const capability of COPILOT_CAPABILITIES) {
    const {receipt}=f.prepare({capability,idempotencyKey:capability});
    assert.equal(receipt.status,capability==='PREPARE_NEXT_EXPERIMENT_DRAFT'?'PREPARED':'SUCCEEDED');
    assert.equal(receipt.result.executionAuthorized,false);
    assert.ok(!JSON.stringify(receipt).includes('Private content body'));
  }
  assert.equal(f.count(),4);
});
test('unknown capability and client authority/tool fields are rejected',t=>{
  const f=fixture(t);
  for(const patch of [{capability:'EXECUTE'},{workspaceId:'b'},{actorId:'user-b'},{prompt:'secret'},{tool:{}}]) assert.throws(()=>f.prepare(patch));
  assert.equal(f.count(),0);
});
test('foreign context experiment candidate and membership fail closed',t=>{
  const f=fixture(t);
  for(const patch of [{experimentId:'exp-b'},{contextVersionId:'ctx-b'},{candidateId:'candidate-b'}]) assert.throws(()=>f.prepare(patch));
  assert.throws(()=>runWithWorkspace('b',()=>f.repository.prepare(input(),actor)),/FORBIDDEN/);
  assert.equal(f.count(),0);
});
test('approved treatment required except for context read',t=>{
  const f=fixture(t);assert.throws(()=>f.prepare({candidateId:null}),/TREATMENT_REQUIRED/);
  f.db.exec("UPDATE growth_content_candidates SET state='REJECTED' WHERE id='candidate-a'");
  assert.throws(()=>f.prepare(),/TREATMENT_INVALID/);
  assert.equal(f.prepare({capability:'READ_GROWTH_CONTEXT',candidateId:null}).receipt.status,'SUCCEEDED');
});
test('stale context and goal mismatch produce no receipt',t=>{
  const f=fixture(t);assert.throws(()=>f.prepare({goalRef:'/strategy/goals/1'}),/REFERENCE_MISMATCH/);
  f.state.isStale=true;assert.throws(()=>f.prepare(),/CONTEXT_STALE/);assert.equal(f.count(),0);
});
test('missing evidence is UNKNOWN not zero or inferred outcome',t=>{
  const f=fixture(t),r=f.prepare().receipt;
  assert.equal(r.result.evidence.state,'UNKNOWN');assert.equal(r.result.evidence.causalLift,'INCONCLUSIVE');
  assert.deepEqual(r.result.evidence.references,[]);assert.equal(r.result.proposal.adoptedExperimentId,null);
});
test('authoritative CRM references are returned but client reports never upgrade',t=>{
  const f=fixture(t);f.fact('client','client');
  assert.equal(f.prepare().receipt.result.evidence.state,'UNKNOWN');
  f.fact('real');const r=f.prepare({idempotencyKey:'new'}).receipt;
  assert.deepEqual(r.result.evidence.references,[{evidenceLinkId:'real',eventId:'real'}]);
  assert.equal(r.result.evidence.attribution,'UNKNOWN');
});
test('read projection reconstructs canonical evidence without creating a receipt',t=>{
  const f=fixture(t);f.fact('real');const before=f.count();
  const result=f.within(()=>f.repository.readEvidence(input(),actor));
  assert.equal(result.state,'OBSERVED');assert.equal(result.references.length,1);assert.equal(f.count(),before);
});
test('eligible CRM selector is bounded, tenant-scoped, masked, and carries no inferred treatment link',t=>{
  const f=fixture(t);for(let i=0;i<30;i++)f.db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?,?)').run(`lead-${i}`,'a',null,'new',`نام ${i}`,'شرکت','09123456789',`2026-09-08T11:${String(i).padStart(2,'0')}:00.000Z`);
  f.db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?,?)').run('foreign','b',null,'new','خارجی','شرکت','09120000000',time);
  f.db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?,?)').run('lost','a',null,'lost','نام نامناسب','شرکت','09120000000',time);
  const first=f.within(()=>f.repository.listEligibleLeads({...input(),limit:10},actor));
  const second=f.within(()=>f.repository.listEligibleLeads({...input(),limit:10,cursor:first.nextCursor},actor));
  assert.equal(first.items.length,10);assert.equal(second.items.length,10);assert.ok(first.nextCursor);
  assert.ok([...first.items,...second.items].every(row=>row.maskedPhone==='0912•••789'&&!row.treatmentLinked&&row.name!=='خارجی'&&row.name!=='نام نامناسب'));
});
test('mismatched canonical event provenance is excluded',t=>{
  const f=fixture(t);f.fact();f.db.exec("UPDATE business_events SET metadata_json='{}'");
  assert.equal(f.prepare().receipt.result.evidence.state,'UNKNOWN');
});
test('same normalized replay converges and conflicting replay fails',t=>{
  const f=fixture(t),r=f.prepare();assert.equal(f.prepare({experimentId:' exp-a '}).receipt.id,r.receipt.id);
  assert.equal(f.prepare().duplicate,true);
  assert.throws(()=>f.prepare({capability:'READ_APPROVED_TREATMENT'}),/REPLAY_CONFLICT/);assert.equal(f.count(),1);
});
test('replay revalidates stale context and reads recheck permission',t=>{
  const f=fixture(t),r=f.prepare();f.state.isStale=true;assert.throws(()=>f.prepare(),/CONTEXT_STALE/);
  f.db.exec("UPDATE workspace_memberships SET status='revoked' WHERE id='a'");
  for(const fn of [()=>f.prepare(),()=>f.within(()=>f.repository.get(r.receipt.id,actor)),()=>f.within(()=>f.repository.list({},actor))])assert.throws(fn,/FORBIDDEN/);
});
test('terminal and input fields immutable; receipts cannot be deleted',t=>{
  const f=fixture(t);f.prepare();
  for(const sql of ["UPDATE growth_copilot_runs SET status='SUCCEEDED'","UPDATE growth_copilot_runs SET input_hash='changed'","DELETE FROM growth_copilot_runs"])assert.throws(()=>f.db.exec(sql),/immutable|append-only/);
});
test('persist failure leaves no completed receipt or domain mutation',t=>{
  const f=fixture(t);f.db.exec("CREATE TRIGGER fail_receipt AFTER INSERT ON growth_copilot_runs BEGIN SELECT RAISE(ABORT,'injected failure'); END");
  assert.throws(()=>f.prepare(),/injected failure/);assert.equal(f.count(),0);
  f.db.exec('DROP TRIGGER fail_receipt');assert.equal(f.prepare().receipt.status,'PREPARED');
});
test('prepare mutates only receipt table; no financial or external action',t=>{
  const f=fixture(t),tables=['experiments','growth_content_candidates','business_events','leads','customers','ecommerce_financial_ledger'];
  const snapshot=()=>tables.map(name=>f.db.prepare(`SELECT * FROM ${name}`).all());
  const before=snapshot();f.prepare();assert.deepEqual(snapshot(),before);
  assert.equal(f.prepare().receipt.result.domainMutation,false);
});
test('reopen preserves exact receipt and never infers a new completion',t=>{
  const f=fixture(t),r=f.prepare(),db=new Database(f.db.serialize());t.after(()=>db.close());
  const repo=createGrowthCopilotRepository(db,f.options);
  assert.deepEqual(f.within(()=>repo.prepare(input(),actor)).receipt,r.receipt);
  assert.equal(f.within(()=>repo.get('absent',actor)),undefined);
});
test('receipt pagination uses bounded stable cursors and no foreign rows',t=>{
  const f=fixture(t);for(let i=0;i<4;i++)f.prepare({idempotencyKey:String(i)});
  const a=f.within(()=>f.repository.list({limit:2},actor)),b=f.within(()=>f.repository.list({limit:2,cursor:a.nextCursor},actor));
  assert.equal(a.items.length,2);assert.equal(b.items.length,2);assert.equal(b.nextCursor,null);
  assert.equal(new Set([...a.items,...b.items].map(r=>r.id)).size,4);
  assert.deepEqual(runWithWorkspace('b',()=>f.repository.list({}, {userId:'user-b'})).items,[]);
  for(const query of [{limit:101},{limit:0},{cursor:'bad'},{workspaceId:'b'}])assert.throws(()=>f.within(()=>f.repository.list(query,actor)),/INVALID_PAGE/);
});
test('evidence scan capped and explicitly truncated',t=>{
  const f=fixture(t);for(let i=0;i<30;i++)f.fact('fact-'+i);
  const r=f.prepare().receipt.result.evidence;assert.equal(r.references.length,25);assert.equal(r.truncated,true);
});
test('migration rerun preserves legacy schema and receipt data',t=>{
  const f=fixture(t);f.prepare();const before=f.db.serialize();
  assert.equal(runMigrations(f.db,[migration]).length,1);
  assert.deepEqual(f.db.serialize(),before);assert.equal(f.db.pragma('integrity_check',{simple:true}),'ok');
  assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
});
test('database insert guards reject bypassed tenant and candidate state checks',t=>{
  const f=fixture(t);f.prepare();
  const original=f.db.prepare('SELECT * FROM growth_copilot_runs').get();
  const insert=row=>f.db.prepare(`INSERT INTO growth_copilot_runs(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));
  assert.throws(()=>insert({...original,id:'foreign',idempotency_key:'foreign',candidate_id:'candidate-b'}),/treatment mismatch/);
  assert.throws(()=>insert({...original,id:'actor',idempotency_key:'actor',actor_id:'user-b'}),/actor denied/);
  assert.throws(()=>insert({...original,id:'context',idempotency_key:'context',context_version_id:'ctx-b'}),/context mismatch/);
  f.db.exec("UPDATE growth_content_candidates SET state='REJECTED' WHERE id='candidate-a'");
  assert.throws(()=>insert({...original,id:'rejected',idempotency_key:'rejected'}),/treatment mismatch/);
  assert.equal(f.count(),1);
});
test('migration transaction failure rolls back new table without touching old data',t=>{
  const db=new Database(':memory:');t.after(()=>db.close());
  db.exec('CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES(\'preserved\')');
  assert.throws(()=>runMigrations(db,[{...migration,up(d){migration.up(d);throw Error('migration failure');}}]),/migration failure/);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='growth_copilot_runs'").get(),undefined);
  assert.equal(db.prepare('SELECT value FROM sentinel').get().value,'preserved');
});
test('HTTP composition rejects anonymous and returns receipts through authenticated route',async t=>{
  const f=fixture(t),app=express();app.use(express.json());
  app.use((req,res,next)=>{if(req.headers['x-test-user']){req.user={id:'user-a'};req.membership={status:'active'};}f.within(next);});
  app.use('/api',createGrowthCopilotRouter({repository:f.repository}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/api/growth/copilot/runs`;
  assert.equal((await fetch(url)).status,403);
  const headers={'content-type':'application/json','x-test-user':'yes'};
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(input())});assert.equal(r.status,200);
  const body=await r.json();assert.equal(body.result.receipt.status,'PREPARED');
  assert.equal((await fetch(url+'/'+body.result.receipt.id,{headers})).status,200);
});
