import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import express from 'express';
import { migration001Identity } from '../db/migrations/001_identity.mjs';
import { migration002TenantDomainData } from '../db/migrations/002_tenant_domain_data.mjs';
import { migration014BusinessEventsObservationsSignals } from '../db/migrations/014_business_events_observations_signals.mjs';
import { migration015IntelligenceDataGuards } from '../db/migrations/015_intelligence_data_guards.mjs';
import { migration080GrowthEvidenceLinks } from '../db/migrations/080_growth_evidence_links.mjs';
import { migration082GrowthContent } from '../db/migrations/082_growth_content.mjs';
import { migration083GrowthCandidateEvidence } from '../db/migrations/083_growth_candidate_evidence.mjs';
import { runWithWorkspace } from '../app/tenant-context.mjs';
import { createBusinessEventRepository } from '../app/repositories/business-event-repository.mjs';
import { createBusinessEventService } from '../app/services/business-event-service.mjs';
import { eventTypeRegistry } from '../app/events/event-type-registry.mjs';
import { createGrowthContentRepository } from '../app/repositories/growth-content-repository.mjs';
import { createGrowthContentService } from '../app/services/growth-content-service.mjs';
import { createGrowthEvidenceRepository } from '../app/repositories/growth-evidence-repository.mjs';
import { createGrowthLeadEvidenceRepository } from '../app/repositories/growth-lead-evidence-repository.mjs';
import { createGrowthLeadEvidenceRouter } from '../app/routes/growth-lead-evidence.mjs';
import { CRM_GROWTH_SOURCE } from '../app/growth/crm-evidence-contract.mjs';

// The CRM operation under test is the real canonical workspace-scoped function.
// Bootstrap in a disposable file BEFORE importing its DB-owning module.
const directory=mkdtempSync(join(tmpdir(),'growth-lead-proof-'));
process.env.DATABASE_PATH=join(directory,'test.sqlite');
const crm=await import('../db/workspace-database.mjs');
const {db}=crm;
after(()=>{db.close();rmSync(directory,{recursive:true});});
migration001Identity.up(db);migration002TenantDomainData.up(db);
db.exec(`CREATE TABLE business_context_versions(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,snapshot_json TEXT);
CREATE TABLE experiments(id TEXT PRIMARY KEY,workspace_id TEXT,context_version_id TEXT,goal_contract_version INTEGER,goal_context_version_id TEXT,goal_ref TEXT);
CREATE TABLE ecommerce_orders(id TEXT PRIMARY KEY,workspace_id TEXT,site_project_id TEXT,total_minor INTEGER,currency TEXT,payment_reference TEXT,payment_status TEXT);
CREATE TABLE ecommerce_financial_ledger(id TEXT PRIMARY KEY,workspace_id TEXT,site_project_id TEXT,order_id TEXT,source_type TEXT,source_id TEXT,entry_type TEXT,amount_minor INTEGER,currency TEXT);`);
for(const m of [migration014BusinessEventsObservationsSignals,migration015IntelligenceDataGuards,migration080GrowthEvidenceLinks,migration082GrowthContent,migration083GrowthCandidateEvidence])m.up(db);
const time='2026-09-08T12:00:00.000Z';
async function fixture({approve=true}={}) {
 const ws=randomUUID(),uid=randomUUID(),ctx=randomUUID(),experiment=randomUUID();
 db.prepare('INSERT INTO users(id,mobile,name,created_at,updated_at) VALUES(?,?,?,?,?)').run(uid,uid,'Synthetic',time,time);
 db.prepare('INSERT INTO workspaces(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').run(ws,'Synthetic',ws,time,time);
 db.prepare("INSERT INTO workspace_memberships VALUES(?,?,?,'owner','active',?,?)").run(randomUUID(),ws,uid,time,time);
 db.prepare("INSERT INTO business_context_versions VALUES(?,?,'active',?)").run(ctx,ws,JSON.stringify({strategy:{goals:['More enquiries']}}));
 db.prepare('INSERT INTO experiments VALUES(?,?,?,1,?,?)').run(experiment,ws,ctx,ctx,'/strategy/goals/0');
 const actor={userId:uid},within=fn=>runWithWorkspace(ws,fn);
 const contextGateway={consume:()=>({state:'READY',contextVersionId:ctx,context:{identity:{},brand:{},strategy:{goals:['More enquiries']}},sourceVersionReferences:{brandBook:{id:'synthetic-brand',versionNumber:1}}})};
 const content=createGrowthContentRepository(db,{contextGateway});
 const b=within(()=>content.createBrief({experimentId:experiment,contextVersionId:ctx,goalRef:'/strategy/goals/0',audience:'Synthetic',message:'Contact us',channel:'SOCIAL',contentType:'instagram',idempotencyKey:'brief'},actor)).brief;
 const candidate=(await within(()=>createGrowthContentService({repository:content,execute:async()=>({success:true,answer:'Contact us',provider:'test',model:'test'})}).generate(b.id,{idempotencyKey:'candidate'},actor))).candidate;
 if(approve)within(()=>content.decide(candidate.id,{decision:'APPROVED'},actor));
 const events=createBusinessEventRepository(db),eventService=createBusinessEventService({repository:events,eventRegistry:eventTypeRegistry,contextGateway,signalProducer:{produce:()=>null}}),evidence=createGrowthEvidenceRepository(db);
 const bridge=createGrowthLeadEvidenceRepository(db,{convertLeadToCustomer:crm.convertLeadToCustomer,eventService,eventRepository:events,evidenceRepository:evidence});
 const lead=within(()=>crm.createLead({name:'Synthetic lead'}));
 const request={candidateId:candidate.id,experimentId:experiment,contextVersionId:ctx,goalRef:'/strategy/goals/0',idempotencyKey:'convert'};
 return {ws,uid,ctx,actor,within,bridge,events,eventService,evidence,lead,candidate,request,convert:patch=>within(()=>bridge.convert(lead.id,{...request,...patch},actor))};
}
test('real CRM transition creates one canonical event and linked treatment evidence',async()=>{
 const f=await fixture(),r=f.convert();assert.equal(r.state,'RECORDED');assert.equal(r.factAuthority,'CRM_DOMAIN');
 const lead=f.within(()=>crm.getLeadById(f.lead.id));assert.ok(lead.customerId);assert.equal(lead.status,'converted');
 const e=f.within(()=>f.events.getById(r.eventId));assert.equal(e.subjectId,lead.id);assert.equal(e.properties.customerId,lead.customerId);assert.equal(e.sourceType,CRM_GROWTH_SOURCE);
 const link=f.within(()=>f.evidence.get(r.evidenceId));assert.equal(link.evidence_kind,'CRM_CONVERSION');assert.equal(link.subject_id,f.candidate.id);assert.equal(link.context_version_id,f.ctx);assert.equal(link.authority_class,'REPORTED');assert.equal(r.revenueClaim,false);assert.equal(r.causalClaim,false);
});
test('replay converges without creating another customer event or evidence',async()=>{
 const f=await fixture(),r=f.convert(),second=f.convert();assert.equal(second.eventId,r.eventId);assert.equal(second.evidenceId,r.evidenceId);assert.equal(second.duplicate,true);
 for(const table of ['customers','business_events','growth_evidence_links'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE workspace_id=?`).get(f.ws).n,1);
});
test('conflicting request replay rejects without remapping outcome',async()=>{
 const f=await fixture();f.convert();assert.throws(()=>f.convert({idempotencyKey:'other'}),/REPLAY_CONFLICT/);
});
test('foreign lead and foreign candidate fail closed',async()=>{
 const a=await fixture(),b=await fixture();assert.throws(()=>a.within(()=>a.bridge.convert(b.lead.id,a.request,a.actor)),/NOT_FOUND/);
 assert.throws(()=>a.convert({candidateId:b.candidate.id}),/TREATMENT_INVALID/);
});
test('unapproved candidate cannot claim treatment linkage',async()=>{
 const f=await fixture({approve:false});assert.throws(()=>f.convert(),/TREATMENT_INVALID/);assert.equal(f.within(()=>crm.getLeadById(f.lead.id)).customerId,null);
});
test('goal context and experiment mismatch reject before CRM mutation',async()=>{
 const f=await fixture();for(const patch of [{goalRef:'/strategy/goals/1'},{contextVersionId:'foreign'},{experimentId:'foreign'}])assert.throws(()=>f.convert(patch),/TREATMENT_INVALID/);
 assert.equal(f.within(()=>crm.getLeadById(f.lead.id)).customerId,null);
});
test('member cannot execute bridge and client cannot supply authority',async()=>{
 const f=await fixture();assert.throws(()=>f.convert({workspaceId:'foreign'}),/INVALID/);db.prepare("UPDATE workspace_memberships SET role='member' WHERE workspace_id=?").run(f.ws);assert.throws(()=>f.convert(),/FORBIDDEN/);
});
test('public event ingestion cannot impersonate reserved CRM source',async()=>{
 const f=await fixture();assert.throws(()=>f.within(()=>f.eventService.ingest({eventType:'lead.converted',sourceType:CRM_GROWTH_SOURCE,subjectType:'lead',subjectId:f.lead.id,properties:{customerId:'fake'},occurredAt:time},f.uid)),/cannot be client reported/);
});
test('client-reported conversion stays reported and cannot mint bridge authority',async()=>{
 const f=await fixture();const event=f.within(()=>f.eventService.ingest({eventType:'lead.converted',sourceType:'client',subjectType:'lead',subjectId:f.lead.id,properties:{customerId:'fake'},occurredAt:time,metadata:{factAuthority:'CRM_DOMAIN'}},f.uid)).event;
 const real=f.convert();assert.notEqual(real.eventId,event.id);assert.equal(f.within(()=>f.events.getById(real.eventId)).sourceType,CRM_GROWTH_SOURCE);
 assert.equal(db.prepare('SELECT count(*) AS n FROM business_events WHERE workspace_id=? AND source_type=?').get(f.ws,CRM_GROWTH_SOURCE).n,1);
});
test('canonical CRM fact cannot become payment or revenue evidence',async()=>{
 const f=await fixture(),r=f.convert(),base=f.within(()=>f.evidence.get(r.evidenceId));
 for(const evidenceKind of ['PAYMENT','VERIFIED_REVENUE'])assert.throws(()=>f.within(()=>f.evidence.create({contractVersion:1,contextVersionId:f.ctx,goal:{reference:f.request.goalRef,version:f.ctx},subject:{type:'CONTENT_CANDIDATE',id:f.candidate.id},relation:'HAS_EVIDENCE',object:{type:'EVENT',id:base.object_id},evidenceKind,producer:'test',source:'test',idempotencyKey:evidenceKind})),/CRM_LINKAGE_MISMATCH/);
});
test('producer label cannot upgrade a client event into the reserved CRM bridge',async()=>{
 const f=await fixture(),event=f.within(()=>f.eventService.ingest({eventType:'lead.converted',sourceType:'client',subjectType:'lead',subjectId:f.lead.id,properties:{customerId:'fake'},occurredAt:time},f.uid)).event;
 assert.throws(()=>f.within(()=>f.evidence.create({contractVersion:1,contextVersionId:f.ctx,goal:{reference:f.request.goalRef,version:f.ctx},subject:{type:'CONTENT_CANDIDATE',id:f.candidate.id},relation:'HAS_EVIDENCE',object:{type:'EVENT',id:event.id},evidenceKind:'CRM_CONVERSION',producer:CRM_GROWTH_SOURCE,source:'fake',idempotencyKey:'fake'})),/CRM_LINKAGE_MISMATCH/);
});
test('legacy canonical CRM conversion still converges outside the bridge',async()=>{
 const f=await fixture(),first=f.within(()=>crm.convertLeadToCustomer(f.lead.id)),second=f.within(()=>crm.convertLeadToCustomer(f.lead.id));
 assert.equal(first.alreadyConverted,false);assert.equal(second.alreadyConverted,true);assert.equal(first.customer.id,second.customer.id);
 assert.equal(db.prepare('SELECT count(*) AS n FROM business_events WHERE workspace_id=?').get(f.ws).n,0);
});
test('a reserved-source lookalike without the real CRM relationship cannot replay as success',async()=>{
 const f=await fixture(),customer=f.within(()=>crm.createCustomer({name:'Orphan synthetic'}));
 const normalized={leadId:f.lead.id,idempotencyKey:f.request.idempotencyKey,candidateId:f.request.candidateId,experimentId:f.request.experimentId,contextVersionId:f.request.contextVersionId,goalRef:f.request.goalRef};
 f.within(()=>f.eventService.recordCrmConversion({...normalized,customerId:customer.id,requestHash:createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),occurredAt:time},f.uid));
 assert.throws(()=>f.convert(),/FACT_INVALID/);assert.equal(db.prepare('SELECT count(*) AS n FROM growth_evidence_links WHERE workspace_id=?').get(f.ws).n,0);
});
test('evidence write failure rolls back CRM customer transition and event',async()=>{
 const f=await fixture();const broken=createGrowthLeadEvidenceRepository(db,{convertLeadToCustomer:crm.convertLeadToCustomer,eventService:f.eventService,eventRepository:f.events,evidenceRepository:{create:()=>{throw Error('injected failure');}}});
 assert.throws(()=>f.within(()=>broken.convert(f.lead.id,f.request,f.actor)),/injected failure/);
 assert.equal(f.within(()=>crm.getLeadById(f.lead.id)).customerId,null);for(const table of ['customers','business_events','growth_evidence_links'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE workspace_id=?`).get(f.ws).n,0);
 assert.equal(f.convert().state,'RECORDED');
});
test('event failure also rolls back canonical conversion',async()=>{
 const f=await fixture();const broken=createGrowthLeadEvidenceRepository(db,{convertLeadToCustomer:crm.convertLeadToCustomer,eventService:{recordCrmConversion:()=>{throw Error('event failure');}},eventRepository:f.events,evidenceRepository:f.evidence});
 assert.throws(()=>f.within(()=>broken.convert(f.lead.id,f.request,f.actor)),/event failure/);assert.equal(f.within(()=>crm.getLeadById(f.lead.id)).customerId,null);
});
test('already-converted legacy lead remains UNKNOWN rather than inventing historical evidence',async()=>{
 const f=await fixture();f.within(()=>crm.convertLeadToCustomer(f.lead.id));const r=f.convert();assert.equal(r.state,'UNKNOWN');assert.equal(r.reason,'NO_RECORDED_TRANSITION');assert.equal(r.eventId,null);
});
test('missing treatment linkage records real conversion but no inferred evidence',async()=>{
 const f=await fixture(),r=f.within(()=>f.bridge.convert(f.lead.id,{idempotencyKey:'unlinked'},f.actor));assert.equal(r.state,'UNKNOWN');assert.ok(r.eventId);assert.equal(r.evidenceId,null);assert.ok(f.within(()=>crm.getLeadById(f.lead.id)).customerId);
});
test('reload preserves replay identity without executing CRM again',async t=>{
 const f=await fixture(),r=f.convert(),reopened=new Database(join(directory,'test.sqlite'));t.after(()=>reopened.close());reopened.pragma('foreign_keys=ON');
 const bridge=createGrowthLeadEvidenceRepository(reopened,{convertLeadToCustomer:()=>{throw Error('must not run');},eventService:f.eventService,eventRepository:createBusinessEventRepository(reopened),evidenceRepository:createGrowthEvidenceRepository(reopened)});
 const next=f.within(()=>bridge.convert(f.lead.id,f.request,f.actor));assert.equal(next.eventId,r.eventId);assert.equal(next.evidenceId,r.evidenceId);
});
test('HTTP bridge rejects anonymous and exposes only bounded identifiers',async t=>{
 const f=await fixture(),app=express();app.use(express.json());app.use((req,res,next)=>{if(req.headers['x-test-user']){req.user={id:f.uid};req.membership={status:'active'};}f.within(next);});app.use('/api',createGrowthLeadEvidenceRouter({repository:f.bridge}));
 const s=app.listen(0,'127.0.0.1');await new Promise(resolve=>s.once('listening',resolve));t.after(()=>new Promise(resolve=>s.close(resolve)));const url=`http://127.0.0.1:${s.address().port}/api/growth/leads/${f.lead.id}/convert`;
 assert.equal((await fetch(url,{method:'POST'})).status,403);const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-test-user':'yes'},body:JSON.stringify(f.request)});assert.equal(response.status,200);const json=await response.json();assert.equal(json.result.state,'RECORDED');assert.ok(!JSON.stringify(json).includes('Synthetic lead'));
});
