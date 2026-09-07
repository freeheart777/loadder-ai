import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import { migration080GrowthEvidenceLinks as m80 } from '../db/migrations/080_growth_evidence_links.mjs';
import { migration082GrowthContent as m82 } from '../db/migrations/082_growth_content.mjs';
import { migration083GrowthCandidateEvidence as m83 } from '../db/migrations/083_growth_candidate_evidence.mjs';
import { createGrowthContentRepository } from '../app/repositories/growth-content-repository.mjs';
import { createGrowthContentService } from '../app/services/growth-content-service.mjs';
import { createGrowthContentRouter } from '../app/routes/growth-content.mjs';
import { createGrowthEvidenceRepository } from '../app/repositories/growth-evidence-repository.mjs';
import { createBusinessContextConsumerGateway } from '../app/context-consumers/business-context-consumer-gateway.mjs';
import { contextCapabilityRegistry } from '../app/context-consumers/capability-registry.mjs';
import { runWithWorkspace } from '../app/tenant-context.mjs';
import { runMigrations } from '../db/migrate.mjs';
import { executeAgentTask } from '../ai/agent/executor.js';
import { getProvider } from '../ai/providers/index.js';

const actor={userId:'user-a'},time='2026-09-07T12:00:00.000Z';
const input=()=>({experimentId:'experiment-a',contextVersionId:'ctx-a',goalRef:'/strategy/goals/0',audience:'Small businesses',message:'Book a consultation',channel:'SOCIAL',contentType:'instagram',constraints:['No unsupported claims'],idempotencyKey:'brief-1'});
const answer={success:true,answer:'برای مشاوره تماس بگیرید',provider:'cloudflare',model:'model',usage:{inputTokens:12,outputTokens:8,totalTokens:20},raw:{private:'never retain'}};
const link=(key='link',patch={})=>({contractVersion:1,contextVersionId:'ctx-a',goal:{reference:'/strategy/goals/0',version:'ctx-a'},subject:{type:'EXPERIMENT',id:'experiment-a'},relation:'HAS_EVIDENCE',object:{type:'EVENT',id:'event-a'},evidenceKind:'REPORTED_CONVERSION',producer:'test',source:'test',idempotencyKey:key,...patch});
function fixture(t,{migrate=true}={}) {
 const db=new Database(':memory:');t.after(()=>db.close());db.pragma('foreign_keys=ON');
 db.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY);
 CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,status TEXT,role TEXT);
 CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,snapshot_json TEXT);
 CREATE TABLE experiments(id TEXT PRIMARY KEY,workspace_id TEXT,context_version_id TEXT,goal_contract_version INTEGER,goal_context_version_id TEXT,goal_ref TEXT);
 CREATE TABLE marketing_campaigns(id TEXT PRIMARY KEY,workspace_id TEXT);
 CREATE TABLE business_events(id TEXT PRIMARY KEY,workspace_id TEXT,event_type TEXT);
 CREATE TABLE ecommerce_orders(id TEXT PRIMARY KEY,workspace_id TEXT,site_project_id TEXT,total_minor INTEGER,currency TEXT,payment_reference TEXT,payment_status TEXT);
 CREATE TABLE ecommerce_financial_ledger(id TEXT PRIMARY KEY,workspace_id TEXT,site_project_id TEXT,order_id TEXT,source_type TEXT,source_id TEXT,entry_type TEXT,amount_minor INTEGER,currency TEXT);`);
 const snapshot={identity:{businessName:'Synthetic'},strategy:{goals:['More enquiries','Other goal']},audiences:{},brand:{tone:'Professional',messagingPrinciples:['Truthful']},offerings:['Consultation']};
 for(const w of ['a','b']) {
  db.prepare('INSERT INTO workspaces VALUES(?)').run(w);
  db.prepare('INSERT INTO workspace_memberships VALUES(?,?,?,?,?)').run('m-'+w,w,'user-'+w,'active','owner');
  db.prepare('INSERT INTO business_context_versions VALUES(?,?,?,?)').run('ctx-'+w,w,'active',JSON.stringify(snapshot));
  db.prepare('INSERT INTO experiments VALUES(?,?,?,?,?,?)').run('experiment-'+w,w,'ctx-'+w,1,'ctx-'+w,'/strategy/goals/0');
  db.prepare('INSERT INTO marketing_campaigns VALUES(?,?)').run('campaign-'+w,w);
  db.prepare('INSERT INTO business_events VALUES(?,?,?)').run('event-'+w,w,'lead.converted');
 }
 m80.up(db);m82.up(db);if(migrate)m83.up(db);
 const state={activeContext:{id:'ctx-a',contextSchemaVersion:'1.0',snapshot,sourceManifest:{brandBook:{id:'brand-a',versionNumber:1},businessDna:{id:'dna-a',versionNumber:1}}},isStale:false,staleReasons:[]};
 const gateway=createBusinessContextConsumerGateway({businessContextService:{getCurrent:()=>state},usageRepository:{record:()=>({id:'usage'})},capabilityRegistry:contextCapabilityRegistry});
 const repo=createGrowthContentRepository(db,{contextGateway:gateway,now:()=>new Date(time)});
 const evidence=createGrowthEvidenceRepository(db,{now:()=>new Date(time)});
 const within=fn=>runWithWorkspace('a',fn);
 const brief=patch=>within(()=>repo.createBrief({...input(),...patch},actor).brief);
 const generate=(b,patch={},execute=async()=>answer)=>within(()=>createGrowthContentService({repository:repo,execute}).generate(b.id,{idempotencyKey:'candidate-1',...patch},actor));
 const decide=(c,decision='APPROVED')=>within(()=>repo.decide(c.id,{decision},actor));
 return {db,repo,evidence,within,brief,generate,decide,state,gateway};
}
test('brief create/read/reload pins context experiment goal and Brand provenance',t=>{
 const f=fixture(t),b=f.brief({offer:{type:'CONTEXT_OFFERING',index:0}});
 assert.equal(b.goal_context_version_id,'ctx-a');assert.equal(b.experiment_id,'experiment-a');assert.equal(b.goal_ref,'/strategy/goals/0');assert.equal(JSON.parse(b.provenance_json).brandBook.id,'brand-a');
 const reopened=new Database(f.db.serialize());t.after(()=>reopened.close());assert.deepEqual(reopened.prepare('SELECT * FROM growth_content_briefs').get(),b);
});
test('brief idempotency converges and conflicting replay rejects',t=>{
 const f=fixture(t),b=f.brief();assert.equal(f.brief().id,b.id);assert.throws(()=>f.brief({message:'different'}),/IDEMPOTENCY_CONFLICT/);
});
test('new briefs reject stale context missing goals foreign experiments and unknown offer types',t=>{
 const f=fixture(t);for(const p of [{experimentId:'experiment-b'},{goalRef:'/strategy/goals/1'},{offer:{type:'ARBITRARY',index:0}},{offer:{type:'CONTEXT_OFFERING',index:90}}])assert.throws(()=>f.brief(p));
 f.state.isStale=true;assert.throws(()=>f.brief(),/CONTEXT_STALE/);
});
test('server-derived author and tenant deny member/foreign access',t=>{
 const f=fixture(t),b=f.brief();assert.throws(()=>runWithWorkspace('b',()=>f.repo.getBrief(b.id,actor)),/ACCESS_DENIED/);
 assert.equal(runWithWorkspace('b',()=>f.repo.getBrief(b.id,{userId:'user-b'})),undefined);
 f.db.exec("UPDATE workspace_memberships SET role='member' WHERE user_id='user-a'");assert.throws(()=>f.brief({idempotencyKey:'new'}),/ACCESS_DENIED/);
});
test('client cannot provide authority timeout provider or tenant fields',async t=>{
 const f=fixture(t);assert.throws(()=>f.brief({workspaceId:'b'}),/CONTRACT_INVALID/);const b=f.brief();
 for(const p of [{provider:'other'},{timeoutMs:999999},{state:'APPROVED'}])await assert.rejects(()=>f.generate(b,p),/CONTRACT_INVALID/);
});
test('successful normalized generation excludes raw payload and persists across reopen',async t=>{
 const f=fixture(t),b=f.brief(),r=await f.generate(b);assert.equal(r.candidate.state,'VALIDATED');assert.equal(r.publishingAuthorized,false);
 assert.equal(r.candidate.body,answer.answer);assert.equal(JSON.parse(r.candidate.usage_json).totalTokens,20);assert.ok(!JSON.stringify(r).includes('never retain'));
 const reopened=new Database(f.db.serialize());t.after(()=>reopened.close());assert.deepEqual(reopened.prepare('SELECT * FROM growth_content_candidates').get(),r.candidate);
});
test('duplicate generation converges without provider repeat and conflicting replay rejects',async t=>{
 const f=fixture(t),b=f.brief();let calls=0;const execute=async()=>{calls++;return answer;};const r=await f.generate(b,{},execute);assert.equal((await f.generate(b,{},execute)).candidate.id,r.candidate.id);assert.equal(calls,1);
 await assert.rejects(()=>f.generate(b,{body:'edit',predecessorId:r.candidate.id}),/IDEMPOTENCY_CONFLICT/);
});
test('explicit provider rejection creates failed identity with no successful body',async t=>{
 const f=fixture(t),r=await f.generate(f.brief(),{},async()=>{throw Object.assign(new Error('private'),{code:'AI_PROVIDER_REJECTED'});});assert.equal(r.candidate.state,'PROVIDER_FAILED');assert.equal(r.candidate.body,null);assert.ok(!JSON.stringify(r).includes('private'));
});
test('unknown outcome blocks blind retry even with a new key and after reload',async t=>{
 const f=fixture(t),b=f.brief(),r=await f.generate(b,{},async()=>{throw Error('connection lost');});assert.equal(r.candidate.state,'RECONCILIATION_REQUIRED');
 await assert.rejects(()=>f.generate(b,{idempotencyKey:'different'}),/RECONCILIATION_REQUIRED/);
 const reopened=new Database(f.db.serialize());t.after(()=>reopened.close());const repo=createGrowthContentRepository(reopened,{contextGateway:f.gateway});assert.throws(()=>f.within(()=>repo.reserve(b.id,{idempotencyKey:'again'},actor)),/RECONCILIATION_REQUIRED/);
});
test('bounded deadline aborts once without automatic retry',async t=>{
 const f=fixture(t),b=f.brief();let calls=0,aborted=false;
 const s=createGrowthContentService({repository:f.repo,timeoutMs:5,execute:(_p,{signal})=>{calls++;signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});}});
 const r=await f.within(()=>s.generate(b.id,{idempotencyKey:'timeout'},actor));assert.equal(r.candidate.state,'RECONCILIATION_REQUIRED');assert.equal(calls,1);assert.equal(aborted,true);
});
test('invalid output cannot become a validated candidate',async t=>{
 const f=fixture(t),r=await f.generate(f.brief(),{},async()=>({...answer,answer:''}));assert.equal(r.candidate.state,'VALIDATION_FAILED');assert.equal(r.candidate.body,null);
});
test('approval and rejection are terminal metadata-only decisions',async t=>{
 const f=fixture(t),b=f.brief(),c=(await f.generate(b)).candidate;
 const approved=f.decide(c);assert.equal(approved.state,'APPROVED');assert.equal(approved.body,c.body);assert.equal(f.decide(c).id,c.id);
 assert.throws(()=>f.decide(c,'REJECTED'),/TRANSITION_CONFLICT/);
 const second=(await f.generate(b,{idempotencyKey:'second'})).candidate;assert.equal(f.decide(second,'REJECTED').state,'REJECTED');
 for(const id of [c.id,second.id]){assert.throws(()=>f.db.prepare("UPDATE growth_content_candidates SET body='edit' WHERE id=?").run(id));assert.throws(()=>f.db.prepare('DELETE FROM growth_content_candidates WHERE id=?').run(id),/append-only/);}
});
test('content cannot change at validation-to-approval transition',async t=>{
 const f=fixture(t),c=(await f.generate(f.brief())).candidate;
 assert.throws(()=>f.db.prepare("UPDATE growth_content_candidates SET body='changed',state='APPROVED',decided_by='user-a',decided_at=? WHERE id=?").run(time,c.id),/immutable/);
});
test('manual edit is a new candidate and requires new approval',async t=>{
 const f=fixture(t),b=f.brief(),c=(await f.generate(b)).candidate;f.decide(c);
 const r=await f.generate(b,{idempotencyKey:'revision',predecessorId:c.id,body:'متن جدید'},()=>{throw Error('must not invoke provider');});assert.notEqual(r.candidate.id,c.id);assert.equal(r.candidate.state,'VALIDATED');assert.equal(r.candidate.predecessor_id,c.id);
 await assert.rejects(()=>f.generate(b,{idempotencyKey:'competing',predecessorId:c.id,body:'other'}),/SUCCESSOR_CONFLICT/);
});
test('brief revisions preserve original and reject competing successors',t=>{
 const f=fixture(t),b=f.brief(),r=f.brief({idempotencyKey:'revision',predecessorId:b.id,message:'New message'});assert.equal(r.version,2);assert.throws(()=>f.brief({idempotencyKey:'competing',predecessorId:b.id}),/SUCCESSOR_CONFLICT/);
 assert.throws(()=>f.db.prepare("UPDATE growth_content_briefs SET contract_json='{}' WHERE id=?").run(b.id),/immutable/);
});
test('candidate count and pagination are bounded',async t=>{
 const f=fixture(t),b=f.brief();for(let i=0;i<10;i++)await f.generate(b,{idempotencyKey:'c'+i});await assert.rejects(()=>f.generate(b,{idempotencyKey:'overflow'}),/CANDIDATE_LIMIT/);
 assert.equal(f.within(()=>f.repo.listCandidates(b.id,{page:1,pageSize:3},actor)).length,3);assert.throws(()=>f.within(()=>f.repo.listBriefs('experiment-a',{pageSize:101},actor)),/PAGE_INVALID/);
});
test('approved candidate is a typed evidence subject without copied content',async t=>{
 const f=fixture(t),c=(await f.generate(f.brief())).candidate;f.decide(c);
 const e=f.within(()=>f.evidence.create(link('candidate',{subject:{type:'CONTENT_CANDIDATE',id:c.id}}))).link;assert.equal(e.subject_id,c.id);assert.ok(!JSON.stringify(e).includes(c.body));assert.equal(e.authority_class,'REPORTED');
});
test('unapproved and rejected candidate cannot be treatment subjects',async t=>{
 const f=fixture(t),c=(await f.generate(f.brief())).candidate;
 const create=()=>f.within(()=>f.evidence.create(link('candidate',{subject:{type:'CONTENT_CANDIDATE',id:c.id}})));assert.throws(create,/APPROVED_TREATMENT/);f.decide(c,'REJECTED');assert.throws(create,/APPROVED_TREATMENT/);
});
test('candidate context goal and tenant mismatch fail closed',async t=>{
 const f=fixture(t),c=(await f.generate(f.brief())).candidate;f.decide(c);
 assert.throws(()=>f.within(()=>f.evidence.create(link('wrong',{subject:{type:'CONTENT_CANDIDATE',id:c.id},goal:{reference:'/strategy/goals/1',version:'ctx-a'}}))),/APPROVED_TREATMENT/);
 assert.throws(()=>runWithWorkspace('b',()=>f.evidence.create({...link(),contextVersionId:'ctx-b',goal:{reference:'/strategy/goals/0',version:'ctx-b'},subject:{type:'CONTENT_CANDIDATE',id:c.id}})),/REFERENCE_NOT_FOUND/);
});
test('legacy evidence migration preserves every value IDs hashes chains indexes and guards',t=>{
 const f=fixture(t,{migrate:false});const a=f.within(()=>f.evidence.create(link('a'))).link;f.within(()=>f.evidence.create(link('b',{supersedesId:a.id})));
 const before=f.db.prepare('SELECT * FROM growth_evidence_links ORDER BY id').all();const objects=f.db.prepare("SELECT name,sql FROM sqlite_master WHERE tbl_name='growth_evidence_links' AND type IN('index','trigger') ORDER BY name").all();
 m83.up(f.db);m83.up(f.db);assert.deepEqual(f.db.prepare('SELECT * FROM growth_evidence_links ORDER BY id').all(),before);
 for(const o of objects)assert.deepEqual(f.db.prepare('SELECT name,sql FROM sqlite_master WHERE name=?').get(o.name),o);
 assert.deepEqual(f.db.pragma('foreign_key_check'),[]);assert.throws(()=>f.db.exec('DELETE FROM growth_evidence_links'),/append-only/);assert.throws(()=>f.db.exec("UPDATE growth_evidence_links SET source='changed'"),/immutable/);
 assert.throws(()=>f.within(()=>f.evidence.create(link('competing',{supersedesId:a.id}))),/SUCCESSOR_CONFLICT/);
 assert.ok(f.within(()=>f.evidence.create(link('campaign',{subject:{type:'CAMPAIGN',id:'campaign-a'}}))).link);
});
test('forced rebuild failure restores original schema and data atomically',t=>{
 const f=fixture(t,{migrate:false});f.within(()=>f.evidence.create(link()));const rows=f.db.prepare('SELECT * FROM growth_evidence_links').all(),schema=f.db.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").all();
 const exec=f.db.exec.bind(f.db);f.db.exec=sql=>{if(sql.startsWith('ALTER TABLE growth_evidence_links_next'))throw Error('injected migration failure');return exec(sql);};
 assert.throws(()=>m83.up(f.db),/injected/);f.db.exec=exec;assert.deepEqual(f.db.prepare('SELECT * FROM growth_evidence_links').all(),rows);assert.deepEqual(f.db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').all(),schema);
 m83.up(f.db);assert.deepEqual(f.db.prepare('SELECT * FROM growth_evidence_links').all(),rows);
});
test('financial authority cannot be claimed from reported events after rebuild',t=>{
 const f=fixture(t);for(const evidenceKind of ['PAYMENT','VERIFIED_REVENUE'])assert.throws(()=>f.within(()=>f.evidence.create(link(evidenceKind,{evidenceKind}))),/FINANCIAL_EVIDENCE/);
});
test('HTTP API is authenticated and returns approval without publishing authority',async t=>{
 const f=fixture(t),app=express();app.use(express.json());app.use((req,res,next)=>{if(req.headers['x-test-auth']){req.user={id:'user-a'};req.membership={status:'active'};}f.within(next);});app.use('/api',createGrowthContentRouter({repository:f.repo,service:createGrowthContentService({repository:f.repo,execute:async()=>answer})}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const url='http://127.0.0.1:'+server.address().port+'/api';
 assert.equal((await fetch(url+'/growth/content/briefs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input())})).status,403);
 const post=async(path,body)=>(await fetch(url+path,{method:'POST',headers:{'content-type':'application/json','x-test-auth':'1'},body:JSON.stringify(body)})).json();
 const b=(await post('/growth/content/briefs',input())).result.brief,c=(await post('/growth/content/briefs/'+b.id+'/candidates',{idempotencyKey:'http'})).result.candidate;
 const decision=await post('/growth/content/candidates/'+c.id+'/decision',{decision:'APPROVED'});assert.equal(decision.result.state,'APPROVED');assert.equal(decision.publishingAuthorized,false);
});
test('canonical executor keeps legacy response while new candidate response omits raw',async t=>{
 const f=fixture(t),entry=getProvider('cloudflare'),oldRun=entry.run,oldHealth=entry.health;let count=0,signal;
 entry.health=()=>true;entry.run=async p=>{count++;signal=p.signal;return {...answer};};t.after(()=>{entry.run=oldRun;entry.health=oldHealth;});
 const legacy=await executeAgentTask({type:'content',topic:'Legacy',maxTokens:500});assert.equal(legacy.answer,answer.answer);assert.deepEqual(legacy.raw,answer.raw);
 const b=f.brief(),r=await f.within(()=>createGrowthContentService({repository:f.repo}).generate(b.id,{idempotencyKey:'canonical'},actor));assert.equal(r.candidate.state,'VALIDATED');assert.ok(signal instanceof AbortSignal);assert.equal(count,2);assert.ok(!JSON.stringify(r).includes('never retain'));
});
test('lost pending process becomes reconciliation-required on late replay',t=>{
 const f=fixture(t),b=f.brief();f.within(()=>f.repo.reserve(b.id,{idempotencyKey:'lost'},actor));
 const repo=createGrowthContentRepository(f.db,{contextGateway:f.gateway,now:()=>new Date('2026-09-07T12:01:00.000Z')});
 const r=f.within(()=>repo.reserve(b.id,{idempotencyKey:'lost'},actor));assert.equal(r.duplicate,true);assert.equal(r.candidate.state,'RECONCILIATION_REQUIRED');
});
test('DB treatment guard independently rejects unapproved foreign and wrong goal references',async t=>{
 const f=fixture(t),c=(await f.generate(f.brief())).candidate;
 const original=f.within(()=>f.evidence.create(link())).link;
 const insert=p=>{const r={...original,id:crypto.randomUUID(),idempotency_key:crypto.randomUUID(),subject_type:'CONTENT_CANDIDATE',subject_id:c.id,...p};f.db.prepare(`INSERT INTO growth_evidence_links(${Object.keys(r).join(',')}) VALUES(${Object.keys(r).map(()=>'?').join(',')})`).run(...Object.values(r));};
 assert.throws(()=>insert({}),/approved treatment mismatch/);f.decide(c);
 assert.throws(()=>insert({goal_reference:'/strategy/goals/1'}),/approved treatment mismatch/);
 assert.throws(()=>insert({workspace_id:'b',context_version_id:'ctx-b',goal_version:'ctx-b'}),/approved treatment mismatch/);
 f.db.exec("UPDATE experiments SET goal_ref='/strategy/goals/1' WHERE id='experiment-a'");assert.throws(()=>insert({}),/approved treatment mismatch/);
});
test('DB financial guards and successor constraints remain final defense',t=>{
 const f=fixture(t),original=f.within(()=>f.evidence.create(link())).link;
 const insert=p=>{const r={...original,id:crypto.randomUUID(),idempotency_key:crypto.randomUUID(),...p};f.db.prepare(`INSERT INTO growth_evidence_links(${Object.keys(r).join(',')}) VALUES(${Object.keys(r).map(()=>'?').join(',')})`).run(...Object.values(r));};
 assert.throws(()=>insert({evidence_kind:'VERIFIED_REVENUE',authority_class:'CANONICAL_RECORD'}),/financial evidence required/);
 insert({supersedes_id:original.id});assert.throws(()=>insert({supersedes_id:original.id}),/UNIQUE/);
});
test('canonical migrator rollback preserves ledger and does not record failed migration',t=>{
 const f=fixture(t,{migrate:false});const a=f.within(()=>f.evidence.create(link('a'))).link;f.within(()=>f.evidence.create(link('b',{supersedesId:a.id})));
 const before=f.db.prepare('SELECT * FROM growth_evidence_links ORDER BY id').all(),exec=f.db.exec.bind(f.db);
 f.db.exec=sql=>{if(sql.startsWith('CREATE TRIGGER IF NOT EXISTS trg_growth_evidence_candidate'))throw Error('forced failure');return exec(sql);};
 assert.throws(()=>runMigrations(f.db,[m83]),/forced failure/);f.db.exec=exec;assert.deepEqual(f.db.prepare('SELECT * FROM growth_evidence_links ORDER BY id').all(),before);assert.equal(f.db.prepare('SELECT count(*) AS n FROM schema_migrations').get().n,0);
 runMigrations(f.db,[m83]);runMigrations(f.db,[m83]);assert.equal(f.db.prepare('SELECT count(*) AS n FROM schema_migrations').get().n,1);assert.deepEqual(f.db.prepare('SELECT * FROM growth_evidence_links ORDER BY id').all(),before);
});
