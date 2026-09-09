import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createMissionControlRepository } from "../app/repositories/mission-control-repository.mjs";
import { createMissionControlService, MISSION_CONTROL_LIMITS } from "../app/services/mission-control-service.mjs";
import { MISSION_CONTROL_READ_POLICY } from "../app/mission-control/ranking-policy.mjs";

const NOW = "2026-09-09T12:00:00.000Z";
const ago = minutes => new Date(Date.parse(NOW) - minutes * 60_000).toISOString();
const future = minutes => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE experiments(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,ends_at TEXT,context_version_id TEXT,goal_ref TEXT,goal_contract_json TEXT);
    CREATE TABLE intelligence_recommendations(id TEXT PRIMARY KEY,workspace_id TEXT,recommendation_type TEXT,consideration_code TEXT,rationale_code TEXT,context_version_id TEXT,subject_type TEXT,subject_id TEXT,subject_key TEXT,calculated_at TEXT,confidence_reason TEXT);
    CREATE TABLE decision_records(id TEXT PRIMARY KEY,workspace_id TEXT,recommendation_id TEXT,decision_type TEXT,supersedes_decision_id TEXT);
    CREATE TABLE growth_content_briefs(id TEXT PRIMARY KEY,workspace_id TEXT,experiment_id TEXT);
    CREATE TABLE growth_content_candidates(id TEXT PRIMARY KEY,workspace_id TEXT,brief_id TEXT,state TEXT,created_at TEXT,updated_at TEXT,body TEXT,provider TEXT);
    CREATE TABLE business_events(id TEXT PRIMARY KEY,workspace_id TEXT,event_type TEXT,source_type TEXT,subject_type TEXT,subject_id TEXT,occurred_at TEXT,context_version_id TEXT,properties_json TEXT,metadata_json TEXT);
    CREATE TABLE growth_evidence_links(id TEXT PRIMARY KEY,workspace_id TEXT,source_event_id TEXT,object_type TEXT,object_id TEXT);
    CREATE INDEX idx_experiment_window ON experiments(workspace_id,ends_at,id);
    CREATE INDEX idx_recommendation_page ON intelligence_recommendations(workspace_id,calculated_at,id);
    CREATE INDEX idx_candidate_state ON growth_content_candidates(workspace_id,state,created_at,id);
    CREATE INDEX idx_event_type_time ON business_events(workspace_id,event_type,occurred_at,id);
  `);
  const repository = createMissionControlRepository(db);
  let stale = false;
  const businessContextService = { getCurrentState: () => ({ isStale: stale, staleReasons: stale ? ["BUSINESS_PROFILE_CHANGED"] : [] }) };
  const service = createMissionControlService({ repository, businessContextService, now: () => new Date(NOW) });
  const insertExperiment = (id, { workspace="a", end=ago(60), status="COMPLETED" }={}) => db.prepare("INSERT INTO experiments VALUES(?,?,?,?,?,?,?)").run(id,workspace,status,end,`context-${workspace}`,"/strategy/goals/0",JSON.stringify({measurementWindow:{start:ago(120),end}}));
  const insertRecommendation = (id, { workspace="a", at=ago(30), subjectId="experiment-a", decided=false, decisionType="ADOPT" }={}) => {
    db.prepare("INSERT INTO intelligence_recommendations VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id,workspace,"EXPERIMENT_OUTCOME_REVIEW","GATHER_MORE_EVIDENCE","INCONCLUSIVE",`context-${workspace}`,"experiment",subjectId,subjectId,at,"No causal confidence; private@example.com must not leak from another column.");
    if (decided) db.prepare("INSERT INTO decision_records VALUES(?,?,?,?,?)").run(`decision-${id}`,workspace,id,decisionType,null);
  };
  const insertCandidate = (id, { workspace="a", state="PENDING", at=ago(20) }={}) => {
    db.prepare("INSERT OR IGNORE INTO growth_content_briefs VALUES(?,?,?)").run(`brief-${workspace}`,workspace,`experiment-${workspace}`);
    db.prepare("INSERT INTO growth_content_candidates VALUES(?,?,?,?,?,?,?,?)").run(id,workspace,`brief-${workspace}`,state,at,at,"secret body","raw-provider");
  };
  const insertConversion = (id, { workspace="a", at=ago(10), linked=false }={}) => {
    db.prepare("INSERT INTO business_events VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,workspace,"lead.converted","loadder.crm.lead-conversion.v1","lead",`lead-${id}`,at,`context-${workspace}`,JSON.stringify({customerId:`customer-${id}`,revenue:999,email:"private@example.com"}),JSON.stringify({providerPayload:"secret"}));
    if (linked) db.prepare("INSERT INTO growth_evidence_links VALUES(?,?,?,?,?)").run(`link-${id}`,workspace,id,"EVENT",id);
  };
  const snapshot = (workspace="a", selectedService=service) => runWithWorkspace(workspace, () => selectedService.getMissionControl());
  return { db, repository, service, businessContextService, setStale:value=>{stale=value;}, insertExperiment, insertRecommendation, insertCandidate, insertConversion, snapshot };
}

test("Mission Control V1", async t => {
  await t.test("signals are factual, bounded, deterministically ranked, and never serialize score", () => {
    const f=fixture();f.insertExperiment("experiment-a",{end:ago(60*24*8)});f.insertConversion("event-a");f.insertRecommendation("rec-a",{subjectId:"another-experiment"});f.insertCandidate("candidate-a",{state:"RECONCILIATION_REQUIRED",at:ago(1)});
    const first=f.snapshot(),second=f.snapshot();assert.deepEqual(first,second);assert.deepEqual(first.items.map(x=>x.signalId),["EXPERIMENT_WINDOW_CLOSED_NO_DECISION","CONVERTED_LEAD_WITHOUT_TREATMENT_LINKAGE","CONTENT_CANDIDATE_STUCK","UNDECIDED_RECOMMENDATION"]);
    assert.equal(JSON.stringify(first).includes('"score"'),false);assert.equal(first.bounds.maxItems,7);assert.equal(first.contractVersion,1);f.db.close();
  });
  await t.test("S1 is capped at two and recommendation content remains belief with null confidence",()=>{const f=fixture();for(let i=0;i<4;i++)f.insertRecommendation(`rec-${i}`,{at:ago(40-i)});const s=f.snapshot();const items=s.items.filter(x=>x.signalId==="UNDECIDED_RECOMMENDATION");assert.equal(items.length,2);assert.equal(items[0].beliefs[0].confidence,null);assert.equal(items[0].facts.some(x=>x.label==="RATIONALE"),false);f.db.close();});
  await t.test("S2 includes ended windows, excludes future windows, and excludes governed conclusions",()=>{const f=fixture();f.insertExperiment("ended");f.insertExperiment("future",{end:future(10),status:"RUNNING"});f.insertExperiment("decided");f.insertRecommendation("decision-rec",{subjectId:"decided",decided:true});const ids=f.snapshot().items.filter(x=>x.signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION").map(x=>x.explainability.experimentId);assert.deepEqual(ids,["ended"]);f.db.close();});
  await t.test("DEFER remains reviewable, supersession uses chain heads, and multiple recommendations are AMBIGUOUS",()=>{const f=fixture();
    f.insertExperiment("deferred");f.insertRecommendation("rec-defer",{subjectId:"deferred",decided:true,decisionType:"DEFER"});
    f.insertExperiment("superseded");f.insertRecommendation("rec-superseded",{subjectId:"superseded"});f.db.prepare("INSERT INTO decision_records VALUES(?,?,?,?,?)").run("old","a","rec-superseded","DEFER",null);f.db.prepare("INSERT INTO decision_records VALUES(?,?,?,?,?)").run("new","a","rec-superseded","ADOPT","old");
    f.insertExperiment("ambiguous");f.insertRecommendation("rec-ambiguous-a",{subjectId:"ambiguous"});f.insertRecommendation("rec-ambiguous-b",{subjectId:"ambiguous"});
    const s=f.snapshot(),byId=new Map(s.items.filter(x=>x.signalId==="EXPERIMENT_WINDOW_CLOSED_NO_DECISION").map(x=>[x.explainability.experimentId,x]));
    assert.equal(byId.get("deferred").facts.find(x=>x.label==="DECISION_STATE").value,"DEFERRED");assert.equal(byId.has("superseded"),false);assert.equal(byId.get("ambiguous").facts.find(x=>x.label==="DECISION_STATE").value,"AMBIGUOUS");f.db.close();});
  await t.test("S2 deterministically replaces colliding S1 after the window closes",()=>{const f=fixture();f.insertExperiment("collision");f.insertRecommendation("collision-rec",{subjectId:"collision"});const s=f.snapshot();assert.equal(s.items.filter(x=>x.explainability.experimentId==="collision").length,1);assert.equal(s.items.find(x=>x.explainability.experimentId==="collision").signalId,"EXPERIMENT_WINDOW_CLOSED_NO_DECISION");f.db.close();});
  await t.test("S4 includes bounded recent canonical missing linkage and excludes linked or old conversion",()=>{const f=fixture();f.insertConversion("missing");f.insertConversion("linked",{linked:true});f.insertConversion("old",{at:ago(31*24*60)});const items=f.snapshot().items.filter(x=>x.signalId==="CONVERTED_LEAD_WITHOUT_TREATMENT_LINKAGE");assert.deepEqual(items.map(x=>x.explainability.eventId),["missing"]);assert.ok(items[0].unknown.includes("ATTRIBUTION"));assert.ok(items[0].unknown.includes("CAUSALITY"));f.db.close();});
  await t.test("S3 includes reconciliation and old pending but excludes recent pending",()=>{const f=fixture();f.insertCandidate("reconcile",{state:"RECONCILIATION_REQUIRED",at:ago(1)});f.insertCandidate("old",{at:ago(16)});f.insertCandidate("recent",{at:ago(14)});const items=f.snapshot().items.filter(x=>x.signalId==="CONTENT_CANDIDATE_STUCK");assert.deepEqual(items.map(x=>x.explainability.candidateId),["reconcile","old"]);assert.ok(items.every(x=>x.action.deepLink==="/dashboard/growth-loop/experiment-a"),"S3 must open the canonical surface that reads the experiment candidates");assert.equal(MISSION_CONTROL_LIMITS.pendingAgeFloorMs,15*60*1000);f.db.close();});
  await t.test("stale context is a separate canonical banner",()=>{const f=fixture();f.setStale(true);assert.deepEqual(f.snapshot().banners,[{code:"STALE_BUSINESS_CONTEXT",staleReasons:["BUSINESS_PROFILE_CHANGED"]}]);f.db.close();});
  await t.test("one failed signal is explicit and does not hide working signals",()=>{const f=fixture();f.insertRecommendation("rec");const broken={...f.repository,stuckCandidates(){throw new Error("private SQL detail");}};const service=createMissionControlService({repository:broken,businessContextService:f.businessContextService,now:()=>new Date(NOW)});const s=f.snapshot("a",service);assert.equal(s.items.length,1);assert.deepEqual(s.signalStatus.find(x=>x.signalId==="S3"),{signalId:"S3",status:"failed"});assert.equal(JSON.stringify(s).includes("private SQL detail"),false);f.db.close();});
  await t.test("tenant isolation and empty workspace success are preserved",()=>{const f=fixture();f.insertExperiment("foreign",{workspace:"b"});f.insertRecommendation("foreign-rec",{workspace:"b"});assert.deepEqual(f.snapshot("a").items,[]);assert.equal(f.snapshot("a").signalStatus.every(x=>x.status==="ok"),true);assert.equal(f.snapshot("b").items.length,2);f.db.close();});
  await t.test("read policy matches existing active-member read models without inline operator authorization",()=>{const f=fixture();assert.equal(MISSION_CONTROL_READ_POLICY,"ACTIVE_WORKSPACE_MEMBER");assert.deepEqual(f.snapshot("a").items,[]);f.db.close();});
  await t.test("final output caps seven with stable oldest-first tie break and explicit truncation",()=>{const f=fixture();for(let i=0;i<10;i++)f.insertConversion(`event-${String(i).padStart(2,"0")}`,{at:ago(100+i)});const s=f.snapshot();assert.equal(s.items.length,7);assert.equal(s.bounds.truncated,true);assert.deepEqual(s.items.map(x=>x.explainability.eventId),["event-09","event-08","event-07","event-06","event-05","event-04","event-03"]);f.db.close();});
  await t.test("state/belief and privacy boundaries never upgrade or leak",()=>{const f=fixture();f.insertRecommendation("rec");f.insertConversion("event");f.insertCandidate("candidate",{state:"RECONCILIATION_REQUIRED"});const text=JSON.stringify(f.snapshot());for(const forbidden of ["secret body","raw-provider","providerPayload","private@example.com",'"revenue"','"effective"','"causal":true','"executable":true'])assert.equal(text.includes(forbidden),false);assert.ok(text.includes('"confidence":null'));assert.ok(text.includes('"ATTRIBUTION"'));f.db.close();});
});
