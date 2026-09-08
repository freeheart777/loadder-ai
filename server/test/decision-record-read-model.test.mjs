import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {runWithWorkspace} from '../app/tenant-context.mjs';
import {createDecisionRecordReadRepository,DECISION_RECORD_READ_LIMITS} from '../app/repositories/decision-record-read-repository.mjs';
import {createDecisionRecordReadService} from '../app/services/decision-record-read-service.mjs';
import {createHumanGovernanceRouter} from '../app/routes/human-governance.mjs';

const AT='2026-09-09T10:00:00.000Z';
const schema=`
CREATE TABLE decision_records(id TEXT PRIMARY KEY,workspace_id TEXT,recommendation_id TEXT,recommendation_version INTEGER,context_version_id TEXT,decider_user_id TEXT,decider_role TEXT,decision_type TEXT,authority_class TEXT,execution_authorizing INTEGER,observed_freshness TEXT,supersedes_decision_id TEXT,decided_at TEXT);
CREATE TABLE intelligence_recommendations(id TEXT PRIMARY KEY,workspace_id TEXT,recommendation_type TEXT,recommendation_version INTEGER,subject_type TEXT,subject_id TEXT,subject_key TEXT,semantic_manifest_json TEXT,point_in_time_cutoff TEXT,producer TEXT,producer_version TEXT,provenance_json TEXT,confidence REAL,confidence_reason TEXT);
CREATE TABLE semantic_findings(id TEXT PRIMARY KEY,workspace_id TEXT,semantic_type TEXT,state TEXT,confidence REAL,confidence_reason TEXT,point_in_time_cutoff TEXT,producer TEXT,producer_version TEXT,evidence_manifest_json TEXT);
CREATE TABLE growth_evidence_links(id TEXT PRIMARY KEY,workspace_id TEXT,evidence_kind TEXT,authority_class TEXT,subject_type TEXT,subject_id TEXT,relation TEXT,object_type TEXT,object_id TEXT,source_event_id TEXT,recorded_at TEXT,correlation_id TEXT,causation_id TEXT,supersedes_id TEXT,producer TEXT,source TEXT);
CREATE TABLE business_events(id TEXT PRIMARY KEY,workspace_id TEXT,occurred_at TEXT);
CREATE INDEX idx_decision_read ON decision_records(workspace_id,id);
CREATE INDEX idx_finding_read ON semantic_findings(workspace_id,id);
CREATE INDEX idx_evidence_read ON growth_evidence_links(workspace_id,id);
`;
function fixture(){
 const db=new Database(':memory:');db.exec(schema);
 const add=(workspace='a',suffix='',options={})=>{
  const evidenceId=`e${suffix}`,findingId=`f${suffix}`,recommendationId=`r${suffix}`,decisionId=`d${suffix}`;
  db.prepare('INSERT INTO business_events VALUES(?,?,?)').run(`event${suffix}`,workspace,AT);
  db.prepare('INSERT INTO growth_evidence_links VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(evidenceId,workspace,options.kind||'CRM_CONVERSION',options.authority||'REPORTED','CONTENT_CANDIDATE','candidate','HAS_EVIDENCE','EVENT',`event${suffix}`,`event${suffix}`,AT,'corr','cause',null,'crm','lead.converted');
  db.prepare('INSERT INTO semantic_findings VALUES(?,?,?,?,?,?,?,?,?,?)').run(findingId,workspace,'growth_experiment_review_readiness','ACTIONABLE',null,'Review readiness only.',AT,'growth_assessment','growth-review-readiness/1',JSON.stringify([{kind:'growth_evidence_link',id:evidenceId}]));
  const provenance=options.partial?{}:{experimentId:'experiment',goalRef:'/strategy/goals/0',candidateId:'candidate',requiredApproval:'HUMAN_REVIEW',policyVersion:'growth-review-readiness/1',rawProviderPayload:{secret:'must-not-leak'}};
  db.prepare('INSERT INTO intelligence_recommendations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(recommendationId,workspace,'EXPERIMENT_OUTCOME_REVIEW',1,'experiment','experiment','candidate',JSON.stringify([{id:findingId}]),AT,'growth_outcome_review','growth-review-readiness/1',JSON.stringify(provenance),null,'Hypothesis only.');
  db.prepare('INSERT INTO decision_records VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(decisionId,workspace,recommendationId,1,'context',`user-${workspace}`,'owner','ADOPT','BUSINESS_INTENT',0,'CURRENT',options.supersedes||null,AT);
  return{evidenceId,findingId,recommendationId,decisionId};
 };
 const a=add(),foreign=add('b','-foreign'),old=add('a','-old');
 db.prepare('UPDATE decision_records SET supersedes_decision_id=? WHERE id=?').run(old.decisionId,a.decisionId);
 const service=createDecisionRecordReadService({repository:createDecisionRecordReadRepository(db)});
 return{db,service,a,foreign,old};
}

test('Decision Record read model v1',async t=>{
 const f=fixture(),within=(workspace,fn)=>runWithWorkspace(workspace,fn);
 await t.test('complete record preserves historical authority, belief and lineage without execution permission',()=>within('a',()=>{
  const record=f.service.getRecord(f.a.decisionId);
  assert.equal(record.explainability.status,'COMPLETE');assert.equal(record.context.experimentId,'experiment');assert.equal(record.treatment.candidateId,'candidate');
  assert.equal(record.evidence[0].authorityClass,'REPORTED');assert.equal(record.evidence[0].evidenceKind,'CRM_CONVERSION');
  assert.equal(record.execution.authorized,false);assert.equal(record.decision.executionAuthorizing,false);assert.equal(record.execution.sourceCopilotRunId,null);
  assert.equal(record.decision.supersedesDecisionId,f.old.decisionId);assert.equal(record.recommendation.requiredApproval,'HUMAN_REVIEW');
  assert.equal(JSON.stringify(record).includes('must-not-leak'),false);
 }));
 await t.test('partial and unknown records do not fabricate missing canonical lineage',()=>within('a',()=>{
  f.db.prepare('INSERT INTO semantic_findings VALUES(?,?,?,?,?,?,?,?,?,?)').run('f-partial','a','attention_state','UNKNOWN',null,'Insufficient evidence.',AT,'test','1','[]');
  f.db.prepare('INSERT INTO intelligence_recommendations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('r-partial','a','attention_evidence_review',1,'scope',null,'scope',JSON.stringify([{id:'f-partial'}]),AT,'test','1','{}',null,'UNKNOWN');
  f.db.prepare('INSERT INTO decision_records VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('d-partial','a','r-partial',1,'context','user-a','owner','DEFER','BUSINESS_INTENT',0,'CURRENT',null,AT);
  const partial=f.service.getRecord('d-partial');assert.equal(partial.explainability.status,'PARTIAL');assert.equal(partial.beliefs.length,1);assert.deepEqual(partial.evidence,[]);
  f.db.prepare('INSERT INTO intelligence_recommendations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('r-unknown','a','attention_evidence_review',1,'scope',null,'scope','[]',AT,'test','1','{}',null,'UNKNOWN');
  f.db.prepare('INSERT INTO decision_records VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('d-unknown','a','r-unknown',1,'context','user-a','owner','DEFER','BUSINESS_INTENT',0,'CURRENT',null,AT);
  const unknown=f.service.getRecord('d-unknown');assert.equal(unknown.explainability.status,'UNKNOWN');assert.deepEqual(unknown.beliefs,[]);assert.deepEqual(unknown.evidence,[]);assert.equal(unknown.context.goalRef,null);
 }));
 await t.test('foreign workspace identifiers fail closed',()=>assert.throws(()=>within('a',()=>f.service.getRecord(f.foreign.decisionId)),error=>error.code==='DECISION_NOT_FOUND'));
 await t.test('historical decision stays pinned to its historical recommendation and evidence',()=>within('a',()=>{
  const historical=f.service.getRecord(f.old.decisionId);assert.equal(historical.decision.supersededByDecisionId,f.a.decisionId);assert.equal(historical.evidence[0].evidenceLinkId,f.old.evidenceId);
 }));
 await t.test('financial and causal authority are never upgraded',()=>within('a',()=>{
  const record=f.service.getRecord(f.a.decisionId);assert.equal(record.evidence[0].authorityClass,'REPORTED');assert.notEqual(record.evidence[0].evidenceKind,'PAYMENT');assert.equal(record.beliefs[0].state,'ACTIONABLE');assert.equal(record.decision.authorityClass,'BUSINESS_INTENT');
 }));
 await t.test('evidence projection is hard-bounded and reports truncation',()=>within('a',()=>{
  assert.deepEqual(DECISION_RECORD_READ_LIMITS,{findings:50,evidence:200});
  const refs=[];const insert=f.db.transaction(()=>{for(let index=0;index<201;index++){const id=`bounded-${index}`;refs.push({kind:'growth_evidence_link',id});f.db.prepare('INSERT INTO business_events VALUES(?,?,?)').run(`event-${id}`,'a',AT);f.db.prepare('INSERT INTO growth_evidence_links VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'a','CRM_CONVERSION','REPORTED','CONTENT_CANDIDATE','candidate','HAS_EVIDENCE','EVENT',`event-${id}`,`event-${id}`,AT,null,null,null,'crm','lead.converted');}});insert();
  f.db.prepare('UPDATE semantic_findings SET evidence_manifest_json=? WHERE id=?').run(JSON.stringify(refs),f.a.findingId);
  const record=f.service.getRecord(f.a.decisionId);assert.equal(record.evidence.length,200);assert.equal(record.bounds.evidenceTruncated,true);assert.equal(record.explainability.status,'PARTIAL');
 }));
 await t.test('narrow HTTP endpoint returns the bounded record and hides foreign IDs',async()=>{
  const app=express();app.use((req,res,next)=>runWithWorkspace(req.headers['x-test-workspace']||'a',next));
  app.use('/api',createHumanGovernanceRouter({service:{},decisionRecordService:f.service}));
  const server=await new Promise(resolve=>{const candidate=app.listen(0,'127.0.0.1',()=>resolve(candidate));});
  const base=`http://127.0.0.1:${server.address().port}/api/intelligence/decisions`;
  let response=await fetch(`${base}/${f.a.decisionId}/record`,{headers:{'x-test-workspace':'a'}});assert.equal(response.status,200);assert.equal((await response.json()).record.decision.id,f.a.decisionId);
  response=await fetch(`${base}/${f.foreign.decisionId}/record`,{headers:{'x-test-workspace':'a'}});assert.equal(response.status,404);
  await new Promise(resolve=>server.close(resolve));
 });
 f.db.close();
});
