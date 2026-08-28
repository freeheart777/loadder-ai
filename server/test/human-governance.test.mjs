import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migrations } from "../db/migrations/index.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { createIntelligenceRecommendationRepository } from "../app/repositories/intelligence-recommendation-repository.mjs";
import { createHumanGovernanceRepository } from "../app/repositories/human-governance-repository.mjs";
import { createHumanGovernanceService } from "../app/services/human-governance-service.mjs";
import { createRecommendationFreshnessQuery } from "../app/recommendations/recommendation-freshness-query.mjs";
import { createOperationMetrics } from "../app/observability/operation-metrics.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

const AT="2026-08-21T12:00:00.000Z";

test("Phase 4G v1 Human Governance", async (t) => {
 const db=new Database(":memory:");db.pragma("foreign_keys = ON");
 db.exec("CREATE TABLE customers(id TEXT PRIMARY KEY,workspace_id TEXT); CREATE TABLE marketing_campaigns(id TEXT PRIMARY KEY,workspace_id TEXT);");
 const migrationList=migrations.filter(({version})=>version<=42);runMigrations(db,migrationList);runMigrations(db,migrationList);
 const setup=(wid)=>{db.prepare("INSERT INTO workspaces(id,name,slug,created_at,updated_at)VALUES(?,?,?,?,?)").run(wid,wid,wid,AT,AT);db.prepare("INSERT INTO business_profiles(id,workspace_id,name,status,created_at,updated_at)VALUES(?,?,?,?,?,?)").run(`p-${wid}`,wid,wid,"active",AT,AT);db.prepare("INSERT INTO business_dna_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at)VALUES(?,?,?,?,?,?,?)").run(`d-${wid}`,wid,`p-${wid}`,1,"active",AT,AT);db.prepare("INSERT INTO brand_book_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at)VALUES(?,?,?,?,?,?,?)").run(`b-${wid}`,wid,`p-${wid}`,1,"active",AT,AT);db.prepare("INSERT INTO business_context_versions(id,workspace_id,business_profile_id,business_dna_version_id,brand_book_version_id,version_number,status,context_schema_version,snapshot_json,source_manifest_json,created_at,activated_at)VALUES(?,?,?,?,?,1,'active','1.0','{}','{}',?,?)").run(`c-${wid}`,wid,`p-${wid}`,`d-${wid}`,`b-${wid}`,AT,AT);};setup("ga");setup("gb");
 const owner={userId:"owner",role:"owner"},admin={userId:"admin",role:"admin"},member={userId:"member",role:"member"};
 const recommendations=createIntelligenceRecommendationRepository(db),repository=createHumanGovernanceRepository(db),metrics=createOperationMetrics({limit:100});let activeContext="c-ga",contextStale=false;const freshness=createRecommendationFreshnessQuery({recommendationRepository:recommendations,currentContextState:()=>({contextVersionId:activeContext,isStale:contextStale})});let tick=0;const service=createHumanGovernanceService({repository,recommendationRepository:recommendations,freshnessQuery:freshness,now:()=>new Date(Date.parse(AT)+(tick++)*1000),operationMetrics:metrics});
 await t.test("migration is idempotent and registers through site builder migration",()=>{const before=db.prepare("SELECT COUNT(*) c,MAX(version) m FROM schema_migrations").get();assert.equal(before.c,42);assert.equal(before.m,42);runMigrations(db);runMigrations(db);const after=db.prepare("SELECT COUNT(*) c,MAX(version) m FROM schema_migrations").get();assert.deepEqual(after,{c:42,m:42});const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('recommendation_reviews','decision_records') ORDER BY name").all().map(r=>r.name);assert.deepEqual(tables,["decision_records","recommendation_reviews"]);});
 await t.test("governance repository exposes tenant-safe lifecycle",()=>runWithWorkspace("ga",()=>{assert.equal(service.listReviews("missing",{}).items.length,0);assert.throws(()=>service.createReview("missing",{reviewType:"ACKNOWLEDGED"},member,"review-1"),/not found/i);}));
 db.close();
});
