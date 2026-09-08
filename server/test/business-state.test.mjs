import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {requireWorkspaceId,runWithWorkspace} from '../app/tenant-context.mjs';
import {createExperimentRepository} from '../app/repositories/experiment-repository.mjs';
import {createIntelligenceRecommendationRepository} from '../app/repositories/intelligence-recommendation-repository.mjs';
import {createGrowthContentRepository} from '../app/repositories/growth-content-repository.mjs';
import {createBusinessStateService,BUSINESS_STATE_LIMITS} from '../app/services/business-state-service.mjs';
import {createBusinessStateRouter} from '../app/routes/business-state.mjs';

const AT='2026-09-09T12:00:00.000Z';
function fixture(){
 const db=new Database(':memory:');db.exec(`
  CREATE TABLE workspace_memberships(id TEXT,user_id TEXT,workspace_id TEXT,role TEXT,status TEXT);
  CREATE TABLE experiments(id TEXT PRIMARY KEY,workspace_id TEXT,decision_id TEXT,context_version_id TEXT,hypothesis TEXT,objective TEXT,success_metric TEXT,baseline_value REAL,treatment_definition TEXT,status TEXT,starts_at TEXT,ends_at TEXT,created_at TEXT,updated_at TEXT,goal_contract_version INTEGER,goal_context_version_id TEXT,goal_ref TEXT,goal_contract_json TEXT,supersedes_experiment_id TEXT);
  CREATE INDEX idx_experiments_page ON experiments(workspace_id,status,created_at DESC,id DESC);
  CREATE TABLE intelligence_recommendations(id TEXT PRIMARY KEY,workspace_id TEXT,calculated_at TEXT);
  CREATE INDEX idx_recommendations_page ON intelligence_recommendations(workspace_id,calculated_at DESC,id DESC);
  CREATE TABLE decision_records(id TEXT PRIMARY KEY,workspace_id TEXT,recommendation_id TEXT);
  CREATE INDEX idx_decisions_recommendation ON decision_records(workspace_id,recommendation_id);
  CREATE TABLE growth_content_candidates(id TEXT PRIMARY KEY,workspace_id TEXT,brief_id TEXT,state TEXT,created_at TEXT);
  CREATE INDEX idx_candidates_page ON growth_content_candidates(workspace_id,brief_id,created_at DESC,id DESC);
 `);
 for(const workspace of ['a','b','c'])db.prepare('INSERT INTO workspace_memberships VALUES(?,?,?,?,?)').run(`m-${workspace}`,`user-${workspace}`,workspace,'owner','active');
 const experimentRepository=createExperimentRepository(db),recommendationRepository=createIntelligenceRecommendationRepository(db),contentRepository=createGrowthContentRepository(db,{});
 let stale=false;
 const businessProfileService={getBusinessProfile:()=>requireWorkspaceId()==='a'?{id:'profile-a',name:'Business A',industry:'Retail',phone:'09120000000',email:'private@example.com'}:null};
 const businessContextService={getCurrentState:()=>requireWorkspaceId()==='a'?{activeContext:{id:'context-a',snapshot:{strategy:{goals:['افزایش سرنخ']},confidence:0.99,attribution:'CAUSAL',revenueEstimate:999}},isStale:stale}:{activeContext:null,isStale:false}};
 const service=createBusinessStateService({businessProfileService,businessContextService,experimentRepository,recommendationRepository,contentRepository,now:()=>new Date(AT)});
 const insertExperiment=(id,workspace='a',status='DRAFT')=>db.prepare('INSERT INTO experiments(id,workspace_id,decision_id,context_version_id,hypothesis,objective,success_metric,treatment_definition,status,created_at,updated_at,goal_context_version_id,goal_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,workspace,`decision-${id}`,`context-${workspace}`,'h','o','lead_count','t',status,AT,AT,`context-${workspace}`,'/strategy/goals/0');
 const insertRecommendation=(id,workspace='a',decided=false)=>{db.prepare('INSERT INTO intelligence_recommendations VALUES(?,?,?)').run(id,workspace,AT);if(decided)db.prepare('INSERT INTO decision_records VALUES(?,?,?)').run(`decision-${id}`,workspace,id);};
 const insertCandidate=(id,state,workspace='a')=>db.prepare('INSERT INTO growth_content_candidates VALUES(?,?,?,?,?)').run(id,workspace,'brief',state,AT);
 return{db,service,setStale:value=>{stale=value;},insertExperiment,insertRecommendation,insertCandidate};
}

test('Business State Snapshot v1',async t=>{
 const f=fixture(),within=(workspace,fn)=>runWithWorkspace(workspace,fn),snapshot=(workspace='a')=>within(workspace,()=>f.service.getSnapshot({workspace:{id:workspace,name:`Workspace ${workspace}`},actor:{userId:`user-${workspace}`}}));
 f.insertExperiment('open');f.insertExperiment('complete','a','COMPLETED');f.insertExperiment('foreign','b');
 f.insertRecommendation('undecided');f.insertRecommendation('decided','a',true);f.insertRecommendation('foreign-rec','b');
 f.insertCandidate('pending','PENDING');f.insertCandidate('reconcile','RECONCILIATION_REQUIRED');f.insertCandidate('approved','APPROVED');f.insertCandidate('foreign-candidate','PENDING','b');
 await t.test('complete snapshot exposes only canonical current state',()=>{const state=snapshot();assert.equal(state.contractVersion,1);assert.equal(state.business.name,'Business A');assert.deepEqual(state.goals,[{ref:'/strategy/goals/0',label:'افزایش سرنخ'}]);assert.deepEqual(state.experiments.open.map(x=>x.id),['open']);assert.deepEqual(state.recommendations.undecidedIds,['undecided']);assert.deepEqual(state.content.pendingCandidateIds,['pending']);assert.deepEqual(state.content.reconciliationRequiredIds,['reconcile']);});
 await t.test('stale context is explicit',()=>{f.setStale(true);assert.equal(snapshot().context.isStale,true);f.setStale(false);});
 await t.test('tenant isolation and empty workspace state are explicit',()=>{const foreign=snapshot('b');assert.equal(foreign.business,null);assert.deepEqual(foreign.experiments.open.map(x=>x.id),['foreign']);assert.deepEqual(foreign.recommendations.undecidedIds,['foreign-rec']);assert.deepEqual(foreign.content.pendingCandidateIds,['foreign-candidate']);const empty=snapshot('c');assert.equal(empty.business,null);assert.equal(empty.context.contextVersionId,null);assert.deepEqual(empty.goals,[]);assert.deepEqual(empty.experiments.open,[]);assert.deepEqual(empty.recommendations.undecidedIds,[]);assert.deepEqual(empty.content.pendingCandidateIds,[]);});
 await t.test('all operational collections are bounded with explicit truncation',()=>{for(let index=0;index<26;index++){f.insertExperiment(`many-exp-${index}`);f.insertRecommendation(`many-rec-${index}`);f.insertCandidate(`many-pending-${index}`,'PENDING');f.insertCandidate(`many-reconcile-${index}`,'RECONCILIATION_REQUIRED');}const state=snapshot();assert.equal(state.experiments.open.length,25);assert.equal(state.experiments.truncated,true);assert.equal(state.recommendations.undecidedIds.length,25);assert.equal(state.recommendations.truncated,true);assert.equal(state.content.pendingCandidateIds.length,25);assert.equal(state.content.reconciliationRequiredIds.length,25);assert.equal(state.content.truncated,true);assert.deepEqual(BUSINESS_STATE_LIMITS,{goals:25,openExperiments:25,undecidedRecommendations:25,pendingCandidates:25,reconciliationCandidates:25});});
 await t.test('belief, attribution, financial estimates, PII and provider payloads never enter State',()=>{const serialized=JSON.stringify(snapshot());for(const forbidden of ['confidence','attribution','causal','revenueEstimate','09120000000','private@example.com','semantic_findings','providerPayload'])assert.equal(serialized.includes(forbidden),false);});
 await t.test('HTTP endpoint derives workspace and actor from authenticated request context',async()=>{const app=express();app.use((req,res,next)=>{req.workspace={id:'a',name:'Workspace A'};req.user={id:'user-a'};runWithWorkspace('a',next);});app.use('/api',createBusinessStateRouter({service:f.service}));const server=await new Promise(resolve=>{const candidate=app.listen(0,'127.0.0.1',()=>resolve(candidate));});const response=await fetch(`http://127.0.0.1:${server.address().port}/api/business-state`);assert.equal(response.status,200);assert.equal((await response.json()).state.workspace.id,'a');await new Promise(resolve=>server.close(resolve));});
 f.db.close();
});
