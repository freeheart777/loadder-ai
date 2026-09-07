import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {migration038Experiments} from '../db/migrations/038_experiments.mjs';
import {migration081ExperimentGoalContract as migration} from '../db/migrations/081_experiment_goal_contract.mjs';
import {createExperimentRepository} from '../app/repositories/experiment-repository.mjs';
import {createExperimentAuthoringRouter} from '../app/routes/experiment-authoring.mjs';
import {runWithWorkspace} from '../app/tenant-context.mjs';
import {migration039ExperimentRuns} from '../db/migrations/039_experiment_runs.mjs';
import {migration040ExperimentRunIdempotency} from '../db/migrations/040_experiment_run_idempotency.mjs';
import {migration041ExperimentRunLeases} from '../db/migrations/041_experiment_run_leases.mjs';
import {createExperimentRunRepository} from '../app/repositories/experiment-run-repository.mjs';
import {createExperimentRunService} from '../app/services/experiment-run-service.mjs';

const at='2026-09-07T12:00:00.000Z';
const payload=()=>({decisionId:'d1',contextVersionId:'ctx-a',goalRef:'/strategy/goals/0',goalContractVersion:1,hypothesis:'Clearer copy may increase enquiries',treatment:'Use approved CTA',goalContract:{metric:'lead_count',direction:'INCREASE',target:10,unit:'COUNT',measurementWindow:{start:at,end:'2026-09-14T12:00:00.000Z'},baseline:{state:'UNKNOWN'}}});
function fixture(t) {
 const db=new Database(':memory:'); t.after(()=>db.close()); db.pragma('foreign_keys=ON');
 db.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY); CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,status TEXT,role TEXT);
 CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,snapshot_json TEXT);
 CREATE TABLE decision_records(id TEXT PRIMARY KEY,workspace_id TEXT,context_version_id TEXT,decision_type TEXT,supersedes_decision_id TEXT);
 CREATE TABLE growth_evidence_links(id TEXT PRIMARY KEY,workspace_id TEXT,context_version_id TEXT,goal_reference TEXT,authority_class TEXT,object_id TEXT,evidence_kind TEXT,supersedes_id TEXT);
 CREATE TABLE ecommerce_financial_ledger(id TEXT PRIMARY KEY,workspace_id TEXT,currency TEXT);`);
 for(const w of ['a','b']) {
  db.prepare('INSERT INTO workspaces VALUES(?)').run(w);
  db.prepare('INSERT INTO business_context_versions VALUES(?,?,?,?)').run(`ctx-${w}`,w,'active',JSON.stringify({strategy:{goals:['More leads']}}));
  db.prepare('INSERT INTO workspace_memberships VALUES(?,?,?,?,?)').run(`m-${w}`,w,`user-${w}`,'active','owner');
 }
 for(const id of ['d0','d1','d2','d3']) db.prepare('INSERT INTO decision_records VALUES(?,?,?,?,NULL)').run(id,'a','ctx-a','ADOPT');
 db.prepare('INSERT INTO decision_records VALUES(?,?,?,?,NULL)').run('db','b','ctx-b','ADOPT');
 migration038Experiments.up(db);
 db.prepare(`INSERT INTO experiments(id,workspace_id,decision_id,context_version_id,hypothesis,objective,success_metric,treatment_definition,status,created_at,updated_at) VALUES('old','a','d0','ctx-a','old hypothesis','old objective','old metric','old treatment','DRAFT',?,?)`).run(at,at);
 const before=db.prepare('SELECT * FROM experiments').get(); migration.up(db); migration.up(db);
 const state={contextVersionId:'ctx-a',isStale:false};
 const repo=createExperimentRepository(db,{currentContextState:()=>state,now:()=>new Date(at)});
 const author=(patch={})=>runWithWorkspace('a',()=>repo.author({...payload(),...patch},{userId:'user-a'}));
 return {db,repo,author,state,before};
}
test('additive migration is repeatable and preserves legacy experiment values',t=>{
 const f=fixture(t),r=runWithWorkspace('a',()=>f.repo.get('old'));
 assert.equal(r.goalContract,null);assert.equal(r.hypothesis,f.before.hypothesis);
 assert.equal(f.db.prepare('PRAGMA table_info(experiments)').all().length,Object.keys(f.before).length+5);
 assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
});
test('create/read/reopen preserves scalar goal identity and UNKNOWN baseline',t=>{
 const f=fixture(t),r=f.author().experiment;
 assert.equal(r.goalContextVersionId,'ctx-a');assert.equal(r.goalRef,'/strategy/goals/0');assert.equal(r.baselineValue,null);assert.equal(r.successMetric,'lead_count');assert.equal(r.status,'DRAFT');
 const db=new Database(f.db.serialize());t.after(()=>db.close());
 assert.deepEqual(runWithWorkspace('a',()=>createExperimentRepository(db).get(r.id)),r);
});
test('same decision replay converges and conflicting authoring rejects',t=>{
 const f=fixture(t),r=f.author();assert.equal(f.author().created,false);assert.equal(f.author().experiment.id,r.experiment.id);
 assert.throws(()=>f.author({hypothesis:'Different'}),/EXPERIMENT_DECISION_CONFLICT/);
});
test('EVIDENCED baseline needs same-goal non-unknown provenance',t=>{
 const f=fixture(t);f.db.exec("INSERT INTO growth_evidence_links VALUES('e','a','ctx-a','/strategy/goals/0','REPORTED','event','CRM_CONVERSION',NULL)");
 const goalContract={...payload().goalContract,baseline:{state:'EVIDENCED',value:3,provenance:{evidenceLinkId:'e'}}};
 assert.equal(f.author({goalContract}).experiment.baselineValue,3);
 f.db.exec("UPDATE growth_evidence_links SET authority_class='UNKNOWN' WHERE id='e'");
 assert.throws(()=>f.author({decisionId:'d2',goalContract}),/EXPERIMENT_BASELINE_EVIDENCE_INVALID/);
});
test('unknown baseline cannot smuggle an inferred value',t=>{
 const f=fixture(t);assert.throws(()=>f.author({goalContract:{...payload().goalContract,baseline:{state:'UNKNOWN',value:0}}}),/EXPERIMENT_GOAL_INVALID/);
});
test('invalid metric direction target unit and window reject',t=>{
 const f=fixture(t);
 for(const patch of [{metric:'causal_lift'},{direction:'AUTO'},{target:-1},{unit:'USD'},{measurementWindow:{start:at,end:at}},{measurementWindow:{start:'2026-02-30T00:00:00.000Z',end:at}},{baseline:{state:'EVIDENCED',value:2,provenance:{}}}]) assert.throws(()=>f.author({goalContract:{...payload().goalContract,...patch}}),/EXPERIMENT_GOAL_INVALID/);
});
test('tenant and author role are server enforced',t=>{
 const f=fixture(t);assert.throws(()=>f.repo.author(payload(),{userId:'user-a'}),/Workspace context/);
 assert.throws(()=>runWithWorkspace('b',()=>f.repo.author(payload(),{userId:'user-a'})),/EXPERIMENT_AUTHOR_FORBIDDEN/);
 f.db.exec("UPDATE workspace_memberships SET role='member' WHERE id='m-a'");assert.throws(()=>f.author(),/EXPERIMENT_AUTHOR_FORBIDDEN/);
});
test('client authority/status fields fail closed',t=>{
 const f=fixture(t);for(const key of ['workspaceId','userId','role','status','baselineValue']) assert.throws(()=>f.author({[key]:'x'}),/EXPERIMENT_GOAL_INVALID/);
});
test('foreign or missing context/goal and stale source state reject new authoring',t=>{
 const f=fixture(t);assert.throws(()=>f.author({contextVersionId:'ctx-b'}),/EXPERIMENT_CONTEXT_STALE/);
 assert.throws(()=>f.author({goalRef:'/strategy/goals/9'}),/EXPERIMENT_GOAL_NOT_FOUND/);
 f.state.isStale=true;assert.throws(()=>f.author(),/EXPERIMENT_CONTEXT_STALE/);
 f.state.isStale=false;f.db.exec("UPDATE business_context_versions SET status='archived' WHERE id='ctx-a'");assert.throws(()=>f.author(),/EXPERIMENT_CONTEXT_STALE/);
});
test('missing declined foreign or superseded decision cannot authorize',t=>{
 const f=fixture(t);for(const decisionId of ['missing','db'])assert.throws(()=>f.author({decisionId}),/EXPERIMENT_DECISION_REQUIRED/);
 f.db.exec("UPDATE decision_records SET decision_type='DECLINE' WHERE id='d1'");assert.throws(()=>f.author(),/EXPERIMENT_DECISION_REQUIRED/);
 f.db.exec("UPDATE decision_records SET decision_type='ADOPT' WHERE id='d1'; UPDATE decision_records SET supersedes_decision_id='d1' WHERE id='d2'");assert.throws(()=>f.author(),/EXPERIMENT_DECISION_REQUIRED/);
});
test('authored definition is immutable but existing status updates still work',t=>{
 const f=fixture(t),r=f.author().experiment;
 for(const column of ['hypothesis','treatment_definition','success_metric','goal_ref','goal_contract_json','objective'])assert.throws(()=>f.db.prepare(`UPDATE experiments SET ${column}='changed' WHERE id=?`).run(r.id),/immutable/);
 assert.throws(()=>f.db.prepare('DELETE FROM experiments WHERE id=?').run(r.id),/append-only/);
 f.db.prepare("UPDATE experiments SET status='READY' WHERE id=?").run(r.id);assert.equal(runWithWorkspace('a',()=>f.repo.get(r.id)).status,'READY');
 assert.throws(()=>f.db.exec("UPDATE experiments SET goal_ref='/strategy/goals/0' WHERE id='old'"),/immutable/);
});
test('revision chains create new rows and allow only one direct successor',t=>{
 const f=fixture(t),a=f.author().experiment,b=f.author({decisionId:'d2',supersedesExperimentId:a.id,hypothesis:'Revised'}).experiment;
 assert.notEqual(a.id,b.id);assert.equal(b.supersedesExperimentId,a.id);
 assert.throws(()=>f.author({decisionId:'d3',supersedesExperimentId:a.id}),/EXPERIMENT_SUCCESSOR_CONFLICT/);
 const c=f.author({decisionId:'d3',supersedesExperimentId:b.id}).experiment;assert.equal(c.supersedesExperimentId,b.id);
 assert.equal(runWithWorkspace('a',()=>f.repo.get(a.id)).hypothesis,a.hypothesis);
});
test('cross-context matching and legacy/foreign predecessor are not inferred',t=>{
 const f=fixture(t),a=f.author().experiment;
 assert.throws(()=>f.author({decisionId:'d2',supersedesExperimentId:'old'}),/EXPERIMENT_PREDECESSOR_INVALID/);
 f.state.contextVersionId='ctx-b';
 assert.throws(()=>runWithWorkspace('b',()=>f.repo.author({...payload(),contextVersionId:'ctx-b',decisionId:'db',supersedesExperimentId:a.id},{userId:'user-b'})),/EXPERIMENT_PREDECESSOR_INVALID/);
 assert.equal(runWithWorkspace('b',()=>f.repo.get(a.id)),undefined);
});
test('old authored revision remains readable after context archival',t=>{
 const f=fixture(t),a=f.author().experiment;f.db.exec("UPDATE business_context_versions SET status='archived' WHERE id='ctx-a'");
 assert.deepEqual(runWithWorkspace('a',()=>f.repo.get(a.id)),a);
});
test('real HTTP create/read and member write denial use repository',async t=>{
 const f=fixture(t),app=express();app.use(express.json());
 app.use((req,res,next)=>{req.user={id:'user-a'};req.membership={status:'active'};runWithWorkspace('a',next);});
 app.use('/api',createExperimentAuthoringRouter({repository:f.repo}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}/api/experiments`;
 const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});assert.equal(r.status,201);const {experiment}=await r.json();
 assert.equal((await fetch(`${url}/${experiment.id}`)).status,200);
 f.db.exec("UPDATE workspace_memberships SET role='member' WHERE id='m-a'");
 assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload(),decisionId:'d2'})})).status,403);
});

test('authored experiment preserves the actual run lifecycle without authorizing execution',t=>{
 const f=fixture(t),e=f.author().experiment;
 for(const m of [migration039ExperimentRuns,migration040ExperimentRunIdempotency,migration041ExperimentRunLeases])m.up(f.db);
 const runs=createExperimentRunService({repository:createExperimentRunRepository(f.db),now:()=>new Date(at)});
 runWithWorkspace('a',()=>{
  assert.throws(()=>runs.create({experimentId:e.id,contextVersionId:'ctx-a'}),/not ready/);
  f.db.prepare("UPDATE experiments SET status='READY' WHERE id=?").run(e.id);
  const r=runs.create({experimentId:e.id,contextVersionId:'ctx-a'});
  runs.start(r.id,{contextVersionId:'ctx-a'});
  assert.equal(runs.complete(r.id,{contextVersionId:'ctx-a',outcome:{state:'UNKNOWN'}}).status,'COMPLETED');
 });
});
test('same-tenant context replacement never auto-matches identical goals',t=>{
 const f=fixture(t),e=f.author().experiment;
 f.db.prepare('INSERT INTO business_context_versions VALUES(?,?,?,?)').run('ctx-new','a','active',JSON.stringify({strategy:{goals:['More leads']}}));
 f.db.exec("UPDATE business_context_versions SET status='archived' WHERE id='ctx-a'; UPDATE decision_records SET context_version_id='ctx-new' WHERE id='d2'");
 f.state.contextVersionId='ctx-new';
 assert.throws(()=>f.author({decisionId:'d2',contextVersionId:'ctx-new',supersedesExperimentId:e.id}),/EXPERIMENT_PREDECESSOR_INVALID/);
});
