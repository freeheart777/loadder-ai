import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migration035SemanticFindings as m35 } from '../db/migrations/035_semantic_findings.mjs';
import { migration036IntelligenceRecommendations as m36 } from '../db/migrations/036_intelligence_recommendations.mjs';
import { migration085GrowthSemanticEvidence as migration } from '../db/migrations/085_growth_semantic_evidence.mjs';
import { runMigrations } from '../db/migrate.mjs';
import { createSemanticFindingRepository } from '../app/repositories/semantic-finding-repository.mjs';
import { createIntelligenceRecommendationRepository } from '../app/repositories/intelligence-recommendation-repository.mjs';
import { createGrowthAssessmentRepository } from '../app/repositories/growth-assessment-repository.mjs';
import { runWithWorkspace } from '../app/tenant-context.mjs';
import { CRM_GROWTH_SOURCE } from '../app/growth/crm-evidence-contract.mjs';
import { migration037HumanGovernance as m37 } from '../db/migrations/037_human_governance.mjs';
import { createHumanGovernanceRepository } from '../app/repositories/human-governance-repository.mjs';
import { createHumanGovernanceService } from '../app/services/human-governance-service.mjs';
const at='2026-09-08T12:00:00.000Z',actor={userId:'user'};
const input={experimentId:'exp',contextVersionId:'ctx',candidateId:'candidate'};
function fixture(t,{applyMigration=true}={}) {
 const db=new Database(':memory:');t.after(()=>db.close());db.pragma('foreign_keys=ON');
 db.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY);INSERT INTO workspaces VALUES('a'),('b');
 CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES('user');
 CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,status TEXT,role TEXT);INSERT INTO workspace_memberships VALUES('m','a','user','active','owner');
 CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT);INSERT INTO business_context_versions VALUES('ctx','a','active'),('ctx-b','b','active');
 CREATE TABLE experiments(id TEXT PRIMARY KEY,workspace_id TEXT,goal_contract_version INTEGER,goal_context_version_id TEXT,goal_ref TEXT,goal_contract_json TEXT);
 CREATE TABLE growth_content_briefs(id TEXT PRIMARY KEY,workspace_id TEXT,experiment_id TEXT,goal_context_version_id TEXT,goal_ref TEXT);INSERT INTO growth_content_briefs VALUES('brief','a','exp','ctx','/strategy/goals/0');
 CREATE TABLE growth_content_candidates(id TEXT PRIMARY KEY,workspace_id TEXT,brief_id TEXT,state TEXT);INSERT INTO growth_content_candidates VALUES('candidate','a','brief','APPROVED');
 CREATE TABLE growth_evidence_links(id TEXT PRIMARY KEY,workspace_id TEXT,subject_type TEXT,subject_id TEXT,recorded_at TEXT,payload_hash TEXT,object_id TEXT,object_type TEXT,evidence_kind TEXT,authority_class TEXT,context_version_id TEXT,goal_reference TEXT,supersedes_id TEXT);
 CREATE INDEX idx_growth_evidence_subject ON growth_evidence_links(workspace_id,subject_type,subject_id,recorded_at,id);
 CREATE TABLE business_events(id TEXT PRIMARY KEY,workspace_id TEXT,occurred_at TEXT,source_type TEXT,event_type TEXT,subject_type TEXT,subject_id TEXT,customer_id TEXT,context_version_id TEXT,properties_json TEXT,metadata_json TEXT);
 CREATE TABLE leads(id TEXT PRIMARY KEY,workspace_id TEXT,customer_id TEXT,status TEXT);INSERT INTO leads VALUES('lead','a','customer','converted');
 CREATE TABLE customers(id TEXT PRIMARY KEY,workspace_id TEXT);INSERT INTO customers VALUES('customer','a');`);
 for(const table of ['normalized_observations','derived_signals','feature_values','listening_aggregates','listening_topic_matches','listening_trend_signals','listening_anomaly_results'])db.exec(`CREATE TABLE ${table}(id TEXT PRIMARY KEY,workspace_id TEXT)`);
 const goal={metric:'lead_count',direction:'INCREASE',target:5,unit:'COUNT',measurementWindow:{start:'2026-09-07T00:00:00.000Z',end:'2026-09-08T00:00:00.000Z'},baseline:{state:'EVIDENCED',value:1,provenance:{evidenceLinkId:'evidence'}}};
 db.prepare('INSERT INTO experiments VALUES(?,?,1,?,?,?)').run('exp','a','ctx','/strategy/goals/0',JSON.stringify(goal));
 m35.up(db);m36.up(db);if(applyMigration)runMigrations(db,[migration]);
 const state={contextVersionId:'ctx',isStale:false};
 const options={semanticRepository:createSemanticFindingRepository(db),recommendationRepository:createIntelligenceRecommendationRepository(db),currentContextState:()=>state,now:()=>new Date(at)};
 const repo=createGrowthAssessmentRepository(db,options),within=fn=>runWithWorkspace('a',fn);
 const fact=(key='evidence',source=CRM_GROWTH_SOURCE)=>{
  db.prepare('INSERT INTO business_events VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(key,'a','2026-09-07T12:00:00.000Z',source,'lead.converted','lead','lead','customer','ctx',JSON.stringify({customerId:'customer'}),JSON.stringify({growth:{candidateId:'candidate',experimentId:'exp',goalRef:'/strategy/goals/0'}}));
  db.prepare('INSERT INTO growth_evidence_links VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL)').run(key,'a','CONTENT_CANDIDATE','candidate',at,'hash-'+key,key,'EVENT','CRM_CONVERSION','REPORTED','ctx','/strategy/goals/0');
 };
 return {db,goal,state,options,repo,within,fact,calculate:()=>within(()=>repo.calculate(input,actor)),setGoal:()=>db.prepare('UPDATE experiments SET goal_contract_json=?').run(JSON.stringify(goal))};
}
test('authoritative complete evidence is ACTIONABLE only for review',t=>{
 const f=fixture(t);f.fact();const r=f.calculate();assert.equal(r.assessment.state,'ACTIONABLE');assert.equal(r.assessment.value.observedCount,1);
 assert.equal(r.assessment.value.effectiveness,'INCONCLUSIVE');assert.equal(r.assessment.value.uplift,null);assert.equal(r.executionAuthorized,false);
});
test('missing evidence stays INCONCLUSIVE',t=>{const f=fixture(t);assert.equal(f.calculate().assessment.state,'INCONCLUSIVE');});
test('UNKNOWN baseline prevents actionable result',t=>{const f=fixture(t);f.fact();f.goal.baseline={state:'UNKNOWN'};f.setGoal();assert.equal(f.calculate().assessment.state,'INCONCLUSIVE');});
test('baseline scalar does not create comparison or uplift',t=>{const f=fixture(t);f.fact();const v=f.calculate().assessment.value;assert.equal(v.baselineComparability,'UNKNOWN');assert.equal(v.uplift,null);});
test('incomplete window is INCONCLUSIVE',t=>{const f=fixture(t);f.fact();f.goal.measurementWindow.end='2026-09-09T00:00:00.000Z';f.setGoal();assert.ok(f.calculate().assessment.value.reasons.includes('INCOMPLETE_WINDOW'));});
test('stale evidence outside window is INCONCLUSIVE',t=>{const f=fixture(t);f.fact();f.db.exec("UPDATE business_events SET occurred_at='2026-09-01T00:00:00.000Z'");assert.equal(f.calculate().assessment.state,'INCONCLUSIVE');});
test('wrong source authority cannot become actionable',t=>{const f=fixture(t);f.fact('evidence','client');assert.equal(f.calculate().assessment.state,'INCONCLUSIVE');});
test('CRM outcomes never become revenue or causality',t=>{const f=fixture(t);f.fact();f.goal.metric='revenue_minor';f.setGoal();const r=f.calculate();assert.equal(r.assessment.state,'INCONCLUSIVE');assert.equal(r.assessment.value.causality,'INCONCLUSIVE');assert.equal(r.assessment.value.attribution,'UNKNOWN');});
test('duplicate canonical lead outcomes count once',t=>{const f=fixture(t);f.fact();f.fact('duplicate');assert.equal(f.calculate().assessment.value.observedCount,1);});
test('truncated evidence cannot become actionable',t=>{const f=fixture(t);for(let i=0;i<201;i++)f.fact(i===0?'evidence':String(i));const r=f.calculate();assert.equal(r.assessment.state,'INCONCLUSIVE');assert.equal(r.assessment.evidenceCount,200);});
test('stale context and foreign tenant denied',t=>{const f=fixture(t);assert.throws(()=>runWithWorkspace('b',()=>f.repo.calculate(input,actor)),/FORBIDDEN/);f.state.isStale=true;assert.throws(()=>f.calculate(),/CONTEXT_STALE/);});
test('unapproved candidate denied',t=>{const f=fixture(t);f.db.exec("UPDATE growth_content_candidates SET state='REJECTED'");assert.throws(()=>f.calculate(),/TREATMENT_INVALID/);});
test('NBA references exact finding and evidence and has only bounded proposal',t=>{const f=fixture(t);f.fact();const r=f.calculate();assert.equal(r.recommendation.recommendationType,'EXPERIMENT_OUTCOME_REVIEW');assert.equal(r.recommendation.semanticFindingReferences[0].id,r.assessment.id);assert.deepEqual(r.recommendation.provenance.evidenceManifest,r.assessment.evidenceReferences);assert.equal(r.recommendation.provenance.executable,false);assert.equal(r.recommendation.provenance.proposedAction,'INSPECT_FUNNEL_BOTTLENECK');});
test('same content replay converges; changed evidence gets new identity',t=>{const f=fixture(t);f.fact();const a=f.calculate(),b=f.calculate();assert.equal(a.assessment.id,b.assessment.id);assert.equal(a.recommendation.id,b.recommendation.id);f.fact('next');assert.notEqual(f.calculate().assessment.id,a.assessment.id);});
test('reload preserves exact result',t=>{const f=fixture(t);f.fact();const a=f.calculate();const db=new Database(f.db.serialize());t.after(()=>db.close());const repo=createGrowthAssessmentRepository(db,{...f.options,semanticRepository:createSemanticFindingRepository(db),recommendationRepository:createIntelligenceRecommendationRepository(db)});assert.equal(f.within(()=>repo.calculate(input,actor)).assessment.id,a.assessment.id);});
test('growth evidence guard rejects missing and foreign-context references',t=>{
 const f=fixture(t);f.fact();const a=f.calculate().assessment;
 const row=f.db.prepare('SELECT * FROM semantic_findings WHERE id=?').get(a.id);
 const insert=r=>f.db.prepare(`INSERT INTO semantic_findings(${Object.keys(r).join(',')}) VALUES(${Object.keys(r).map(()=>'?').join(',')})`).run(...Object.values(r));
 assert.throws(()=>insert({...row,id:'bad',producer_key:'bad',evidence_manifest_json:'[{"kind":"growth_evidence_link","id":"missing"}]'}),/growth semantic evidence mismatch/);
 f.db.exec("UPDATE growth_evidence_links SET workspace_id='b',context_version_id='ctx-b'");
 assert.throws(()=>insert({...row,id:'foreign',producer_key:'foreign'}),/growth semantic evidence mismatch/);
});
test('migration preserves rows hashes and immutable guards; rerun is safe',t=>{
 const f=fixture(t);f.fact();const a=f.calculate();const before=f.db.prepare('SELECT * FROM semantic_findings').all();migration.up(f.db);assert.deepEqual(f.db.prepare('SELECT * FROM semantic_findings').all(),before);
 assert.throws(()=>f.db.exec('DELETE FROM semantic_findings'),/immutable/);assert.equal(f.within(()=>f.options.semanticRepository.getById(a.assessment.id)).id,a.assessment.id);
});
test('forced forward migration failure restores original trigger transactionally',t=>{
 const f=fixture(t);const before=f.db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
 assert.throws(()=>f.db.transaction(()=>{migration.up(f.db);throw Error('forced');})(),/forced/);
 assert.deepEqual(f.db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all(),before);
});
test('human adoption uses canonical governance without execution authority',t=>{
 const f=fixture(t);f.fact();const r=f.calculate();m37.up(f.db);
 const service=createHumanGovernanceService({repository:createHumanGovernanceRepository(f.db),recommendationRepository:f.options.recommendationRepository,freshnessQuery:{resolve:()=> 'CURRENT'},now:()=>new Date(at)});
 const before=f.db.prepare('SELECT * FROM experiments').all();
 const decision=f.within(()=>service.createDecision(r.recommendation.id,{decisionType:'ADOPT',allowStale:false},{userId:'user',membershipId:'m',role:'owner'},'adopt')).decision;
 assert.equal(decision.executionAuthorizing,false);assert.equal(decision.authorityClass,'BUSINESS_INTENT');
 assert.deepEqual(f.db.prepare('SELECT * FROM experiments').all(),before);
});
test('first forward migration preserves pre-existing semantic rows and hashes',t=>{
 const f=fixture(t,{applyMigration:false});
 f.within(()=>f.options.semanticRepository.create({semanticType:'listening_attention_state',semanticVersion:1,schemaVersion:1,subjectType:'listening_scope',subjectId:null,subjectKey:'legacy',state:'STABLE',value:null,evidenceReferences:[],evidenceManifestHash:'original-hash',contextVersionId:'ctx',contextState:'READY',calculatedAt:at,pointInTimeCutoff:at,producer:'legacy',producerVersion:'1',producerKey:'legacy',confidence:null,confidenceReason:'unknown',provenance:{},createdAt:at}));
 const before=f.db.prepare('SELECT * FROM semantic_findings').all();runMigrations(f.db,[migration]);
 assert.deepEqual(f.db.prepare('SELECT * FROM semantic_findings').all(),before);
 assert.throws(()=>f.db.exec('UPDATE semantic_findings SET state=\'CHANGED\''),/immutable/);
});
