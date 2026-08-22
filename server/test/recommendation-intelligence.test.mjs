import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import express from "express";
import crypto from "node:crypto";

import { runMigrations } from "../db/migrate.mjs";
import { migration036IntelligenceRecommendations } from "../db/migrations/036_intelligence_recommendations.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { recommendationContractRegistry } from "../app/recommendations/recommendation-contract-registry.mjs";
import { produceAttentionEvidenceReview, produceCompetitiveVisibilityEvidenceReview } from "../app/recommendations/recommendation-producers.mjs";
import { createSemanticFindingRepository } from "../app/repositories/semantic-finding-repository.mjs";
import { createIntelligenceRecommendationRepository } from "../app/repositories/intelligence-recommendation-repository.mjs";
import { createRecommendationIntelligenceService } from "../app/services/recommendation-intelligence-service.mjs";
import { createRecommendationIntelligenceRouter } from "../app/routes/recommendation-intelligence.mjs";
import { createOperationMetrics } from "../app/observability/operation-metrics.mjs";
import { encodeCursor } from "../app/query/cursor-pagination.mjs";

function copyPhaseBaseline(source,target){copyFileSync(source,target);const db=new Database(target);db.exec("DELETE FROM schema_migrations WHERE version=48;DROP TABLE IF EXISTS content_items;DELETE FROM schema_migrations WHERE version=47;DELETE FROM schema_migrations WHERE version=46;DROP TABLE IF EXISTS content_generations;DELETE FROM schema_migrations WHERE version=45;DROP TABLE IF EXISTS execution_action_inputs;DELETE FROM schema_migrations WHERE version=44;DROP TABLE IF EXISTS execution_dispatch_jobs;DELETE FROM schema_migrations WHERE version=43;DROP TABLE IF EXISTS execution_results;DROP TABLE IF EXISTS provider_invocation_events;DROP TABLE IF EXISTS execution_attempts;DELETE FROM schema_migrations WHERE version=42;DROP TABLE IF EXISTS provider_account_identities;DELETE FROM schema_migrations WHERE version=41;DROP TRIGGER IF EXISTS trg_execution_requests_update;DROP TRIGGER IF EXISTS trg_execution_requests_delete;DROP TRIGGER IF EXISTS trg_execution_requests_insert_guard;DROP INDEX IF EXISTS idx_execution_requests_page;DROP TABLE IF EXISTS execution_requests;DELETE FROM schema_migrations WHERE version=40;");db.close();}
const AT = "2026-08-21T12:00:00.000Z";
const BEFORE = "2026-08-21T11:00:00.000Z";
const AFTER = "2026-08-21T13:00:00.000Z";
const snapshot = JSON.stringify({ identity: {}, metadata: {} });
const sha64 = "a".repeat(64);
const canonical = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;

test("Phase 4F v1 Recommendation Intelligence foundation", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "loadder-recommendation-")), path = join(dir, "recommendation.sqlite");
  copyPhaseBaseline(new URL("../db/loadder.sqlite", import.meta.url), path);
  const db = new Database(path); db.pragma("foreign_keys=ON");
  db.exec(`
    DROP TRIGGER IF EXISTS trg_execution_authorizations_update;
    DROP TRIGGER IF EXISTS trg_execution_authorizations_delete;
    DROP TRIGGER IF EXISTS trg_execution_authorizations_insert_guard;
    DROP INDEX IF EXISTS idx_execution_authorizations_page;
    DROP TABLE IF EXISTS execution_authorizations;
    DELETE FROM schema_migrations WHERE version=39;
    DROP TRIGGER IF EXISTS trg_action_proposals_update;
    DROP TRIGGER IF EXISTS trg_action_proposals_delete;
    DROP TRIGGER IF EXISTS trg_action_proposals_insert_guard;
    DROP INDEX IF EXISTS idx_action_proposals_page;
    DROP TABLE IF EXISTS action_proposals;
    DROP TRIGGER IF EXISTS trg_recommendation_reviews_insert_guard;
    DROP TRIGGER IF EXISTS trg_recommendation_reviews_update;
    DROP TRIGGER IF EXISTS trg_recommendation_reviews_delete;
    DROP TRIGGER IF EXISTS trg_decision_records_insert_guard;
    DROP TRIGGER IF EXISTS trg_decision_records_update;
    DROP TRIGGER IF EXISTS trg_decision_records_delete;
    DROP INDEX IF EXISTS idx_recommendation_reviews_page;
    DROP INDEX IF EXISTS idx_recommendation_reviews_actor;
    DROP INDEX IF EXISTS idx_decision_records_page;
    DROP INDEX IF EXISTS idx_decision_records_actor;
    DROP INDEX IF EXISTS idx_decision_records_one_successor;
    DROP TABLE IF EXISTS decision_records;
    DROP TABLE IF EXISTS recommendation_reviews;
    DROP TRIGGER IF EXISTS trg_intelligence_recommendations_insert_guard;
    DROP TRIGGER IF EXISTS trg_intelligence_recommendations_update;
    DROP TRIGGER IF EXISTS trg_intelligence_recommendations_delete;
    DROP INDEX IF EXISTS idx_intelligence_recommendations_page;
    DROP TABLE IF EXISTS intelligence_recommendations;
    DELETE FROM schema_migrations WHERE version IN(36,37,38);
  `);
  assert.deepEqual(db.prepare("SELECT COUNT(*) c,MAX(version) m FROM schema_migrations").get(), { c: 35, m: 35 });
  const beforeTables = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  runMigrations(db, [migration036IntelligenceRecommendations]);
  runMigrations(db, [migration036IntelligenceRecommendations]);
  for (const workspace of ["recommendation-a", "recommendation-b"]) {
    db.prepare("INSERT INTO workspaces(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)").run(workspace, workspace, workspace, AT, AT);
    db.prepare("INSERT INTO business_profiles(id,workspace_id,name,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(`p-${workspace}`, workspace, workspace, "active", AT, AT);
    db.prepare("INSERT INTO business_dna_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`d-${workspace}`, workspace, `p-${workspace}`, 1, "active", AT, AT);
    db.prepare("INSERT INTO brand_book_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`b-${workspace}`, workspace, `p-${workspace}`, 1, "active", AT, AT);
    db.prepare(`INSERT INTO business_context_versions(id,workspace_id,business_profile_id,business_dna_version_id,brand_book_version_id,version_number,status,context_schema_version,snapshot_json,source_manifest_json,created_at,activated_at) VALUES(?,?,?,?,?,1,'active','1.0',?,'{}',?,?)`).run(`c-${workspace}`, workspace, `p-${workspace}`, `d-${workspace}`, `b-${workspace}`, snapshot, AT, AT);
  }

  let activeWorkspace = "recommendation-a";
  const contexts = new Map([["recommendation-a", "c-recommendation-a"], ["recommendation-b", "c-recommendation-b"]]);
  const gatewayState = { state: "READY" };
  const gateway = { consume: () => ({ state: gatewayState.state, contextVersionId: contexts.get(activeWorkspace), context: { identity: {}, metadata: {} } }) };
  const semanticRepository = createSemanticFindingRepository(db), repository = createIntelligenceRecommendationRepository(db);
  const metrics = createOperationMetrics({ limit: 30 });
  const service = createRecommendationIntelligenceService({ repository, semanticRepository, registry: recommendationContractRegistry, contextGateway: gateway, now: () => new Date(AT), operationMetrics: metrics });
  const within = (workspace, work) => { activeWorkspace = workspace; return runWithWorkspace(workspace, work); };
  const createFinding = ({ id, workspace = "recommendation-a", type, state, cutoff = AT, calculatedAt = cutoff, context = `c-${workspace}`, subjectKey = "brand-monitor", producerVersion = "1.0" }) => within(workspace, () => semanticRepository.create({
    semanticType: type, semanticVersion: 1, schemaVersion: 1, subjectType: "listening_scope", subjectId: null, subjectKey,
    state, value: null, evidenceReferences: [], evidenceManifestHash: sha64, contextVersionId: context, contextState: "READY",
    calculatedAt, pointInTimeCutoff: cutoff, producer: `semantic_${type}`, producerVersion, producerKey: id,
    confidence: null, confidenceReason: "NOT_STATISTICALLY_CALIBRATED", provenance: { scope: { window: "24h" } }, createdAt: cutoff,
  }).finding);
  const request = (types = ["attention_evidence_review"]) => ({ recommendationTypes: types, subjectType: "listening_scope", subjectId: null, subjectKey: "brand-monitor", pointInTimeCutoff: AT, scope: { window: "24h" } });

  await t.test("migration 036 is idempotent and creates exactly one table", () => {
    assert.equal(db.prepare("SELECT COUNT(*) c FROM schema_migrations").get().c, 36);
    assert.equal(db.prepare("SELECT MAX(version) v FROM schema_migrations").get().v, 36);
    const after = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='intelligence_recommendations' ORDER BY name").all();
    assert.deepEqual(after, beforeTables);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='intelligence_recommendations'").get().c, 1);
  });
  await t.test("registry contains exactly two bounded contracts", () => {
    assert.deepEqual(recommendationContractRegistry.list().map((item) => item.recommendationType), ["attention_evidence_review", "competitive_visibility_evidence_review"]);
    assert.equal(recommendationContractRegistry.get("execute_campaign"), null);
    assert.deepEqual(recommendationContractRegistry.get("attention_evidence_review").scopeKeys, ["window"]);
  });
  await t.test("pure deterministic producers implement only approved mappings", () => {
    assert.deepEqual(produceAttentionEvidenceReview({ state: "SURGING" }), { considerationCode: "REVIEW_ATTENTION_SPIKE", rationaleCode: "ATTENTION_RISING_WITH_ELEVATED_ANOMALY", reviewPriority: "HIGH", confidence: null, confidenceReason: "DETERMINISTIC_POLICY_NOT_OUTCOME_CALIBRATED" });
    assert.equal(produceAttentionEvidenceReview({ state: "STABLE" }), null);
    assert.equal(produceAttentionEvidenceReview({ state: "INSUFFICIENT_EVIDENCE" }), null);
    assert.equal(produceCompetitiveVisibilityEvidenceReview({ state: "TRAILING" }).considerationCode, "REVIEW_COMPETITIVE_VISIBILITY_GAP");
    for (const state of ["LEADING", "PARITY", "INSUFFICIENT_EVIDENCE"]) assert.equal(produceCompetitiveVisibilityEvidenceReview({ state }), null);
  });

  const attention = createFinding({ id: "attention-rising", type: "listening_attention_state", state: "RISING" });
  createFinding({ id: "competitive-trailing", type: "competitive_visibility_state", state: "TRAILING" });
  let firstRecommendation;
  await t.test("calculation creates bounded advisory records with exact semantic provenance", () => within("recommendation-a", () => {
    const result = service.calculate(request(["attention_evidence_review", "competitive_visibility_evidence_review"]), "user-a");
    assert.equal(result.state, "RECOMMENDATIONS_AVAILABLE"); assert.equal(result.createdCount, 2); assert.equal(result.reusedResult, false);
    firstRecommendation = result.recommendations[0];
    assert.equal(firstRecommendation.considerationCode, "REVIEW_ATTENTION_INCREASE"); assert.equal(firstRecommendation.reviewPriority, "MEDIUM");
    assert.equal(firstRecommendation.confidence, null); assert.equal(firstRecommendation.semanticFindingReferences[0].id, attention.id);
    assert.match(firstRecommendation.semanticManifestHash, /^[a-f0-9]{64}$/);
    assert.equal(firstRecommendation.semanticManifestHash, crypto.createHash("sha256").update(canonical(firstRecommendation.semanticFindingReferences)).digest("hex"));
    assert.deepEqual(firstRecommendation.provenance, { advisoryOnly: true, causalClaim: false, executable: false, policyVersion: "1.0", semanticManifestHash: firstRecommendation.semanticManifestHash, scope: { window: "24h" } });
    assert.equal(Object.hasOwn(firstRecommendation, "status"), false); assert.equal(Object.hasOwn(firstRecommendation, "parameters"), false);
  }));
  await t.test("exact reuse writes zero rows and does not duplicate history", () => within("recommendation-a", () => {
    const before = db.prepare("SELECT COUNT(*) c FROM intelligence_recommendations").get().c;
    const result = service.calculate(request(["attention_evidence_review", "competitive_visibility_evidence_review"]));
    assert.equal(result.reusedResult, true); assert.equal(result.createdCount, 0); assert.equal(db.prepare("SELECT COUNT(*) c FROM intelligence_recommendations").get().c, before);
    const measurement = metrics.recent().at(-1); assert.equal(measurement.rowsWritten, 0); assert.equal(measurement.semanticFindingCount, 2);
  }));
  await t.test("concurrent duplicate requests converge at the unique identity", async () => {
    const before = db.prepare("SELECT COUNT(*) c FROM intelligence_recommendations").get().c;
    const results = await Promise.all([1, 2, 3].map(() => within("recommendation-a", () => service.calculate(request()))));
    assert.ok(results.every((result) => result.recommendations[0].id === firstRecommendation.id));
    assert.equal(db.prepare("SELECT COUNT(*) c FROM intelligence_recommendations").get().c, before);
  });
  await t.test("no-op semantic states never persist recommendation rows", () => within("recommendation-a", () => {
    createFinding({ id: "attention-stable", type: "listening_attention_state", state: "STABLE", subjectKey: "stable-scope" });
    const before = db.prepare("SELECT COUNT(*) c FROM intelligence_recommendations").get().c;
    const result = service.calculate({ ...request(), subjectKey: "stable-scope" });
    assert.deepEqual(result.recommendations, []); assert.equal(result.state, "NO_RECOMMENDATION"); assert.equal(result.skipped[0].reason, "NO_RECOMMENDATION");
    assert.equal(db.prepare("SELECT COUNT(*) c FROM intelligence_recommendations").get().c, before);
  }));
  await t.test("missing evidence produces an explicit no-recommendation result", () => within("recommendation-a", () => {
    const result = service.calculate({ ...request(), subjectKey: "missing" });
    assert.equal(result.state, "NO_RECOMMENDATION"); assert.equal(result.skipped[0].reason, "SEMANTIC_FINDING_UNAVAILABLE");
  }));
  await t.test("Context states and mismatches use stable 409 errors", () => within("recommendation-a", () => {
    gatewayState.state = "STALE_CONTEXT";
    assert.throws(() => service.calculate({ ...request(), subjectKey: "new-miss" }), (error) => error.status === 409 && error.code === "STALE_CONTEXT");
    gatewayState.state = "MISSING_CONTEXT";
    assert.throws(() => service.calculate({ ...request(), subjectKey: "new-miss" }), (error) => error.status === 409 && error.code === "MISSING_CONTEXT");
    gatewayState.state = "READY";
    contexts.set("recommendation-a", "c-recommendation-b");
    assert.throws(() => service.calculate(request()), (error) => error.status === 409 && error.code === "CONTEXT_SEMANTIC_MISMATCH");
    contexts.set("recommendation-a", "c-recommendation-a");
  }));
  await t.test("point-in-time selection excludes future Semantic Findings", () => within("recommendation-a", () => {
    createFinding({ id: "attention-future", type: "listening_attention_state", state: "SURGING", cutoff: AFTER, subjectKey: "future-scope" });
    const result = service.calculate({ ...request(), subjectKey: "future-scope", pointInTimeCutoff: AT });
    assert.equal(result.state, "NO_RECOMMENDATION"); assert.equal(result.skipped[0].reason, "SEMANTIC_FINDING_UNAVAILABLE");
    createFinding({ id: "attention-before", type: "listening_attention_state", state: "FALLING", cutoff: BEFORE, subjectKey: "future-scope" });
    assert.equal(service.calculate({ ...request(), subjectKey: "future-scope", pointInTimeCutoff: AT }).recommendations[0].considerationCode, "REVIEW_ATTENTION_DECLINE");
  }));
  await t.test("version, policy, Context, and Semantic identity invalidate reuse", () => within("recommendation-a", () => {
    const original = recommendationContractRegistry.get("attention_evidence_review");
    for (const change of [{ producerVersion: "2.0" }, { recommendationVersion: 2 }, { policyVersion: "2.0" }]) {
      const changed = Object.freeze({ ...original, ...change });
      const revised = createRecommendationIntelligenceService({ repository, semanticRepository, registry: { get: () => changed }, contextGateway: gateway, now: () => new Date(AT) });
      assert.equal(revised.calculate(request()).createdCount, 1);
    }
    createFinding({ id: "attention-rising-v2", type: "listening_attention_state", state: "RISING", producerVersion: "2.0", calculatedAt: AFTER });
    assert.equal(service.calculate(request()).createdCount, 1);
  }));
  await t.test("strict validation rejects client ownership and unsupported inputs", () => within("recommendation-a", () => {
    assert.throws(() => service.calculate({ ...request(), workspaceId: "recommendation-b" }), /unsupported fields|workspace/i);
    assert.throws(() => service.calculate({ ...request(), scope: { window: "24h", channel: "all" } }), /scope/);
    assert.throws(() => service.calculate({ ...request(), recommendationTypes: ["unknown"] }), /unregistered/);
    assert.throws(() => service.calculate({ ...request(), recommendationTypes: ["attention_evidence_review", "competitive_visibility_evidence_review", "x"] }), /recommendationTypes/);
  }));
  await t.test("database guards enforce immutability and tenant-safe references", () => {
    assert.throws(() => db.prepare("UPDATE intelligence_recommendations SET review_priority='LOW' WHERE id=?").run(firstRecommendation.id), /immutable/);
    assert.throws(() => db.prepare("DELETE FROM intelligence_recommendations WHERE id=?").run(firstRecommendation.id), /immutable/);
    const base = { ...firstRecommendation, id: "attack", producerKey: "attack", semanticFindingReferences: [{ ...firstRecommendation.semanticFindingReferences[0], id: "missing" }] };
    assert.throws(() => within("recommendation-a", () => repository.create(base)), /missing/);
    const foreign = createFinding({ id: "foreign", workspace: "recommendation-b", type: "listening_attention_state", state: "RISING" });
    const foreignReference = { ...firstRecommendation.semanticFindingReferences[0], id: foreign.id, contextVersionId: foreign.contextVersionId };
    assert.throws(() => within("recommendation-a", () => repository.create({ ...base, id: "attack2", producerKey: "attack2", semanticFindingReferences: [foreignReference] })), /workspace mismatch/);
  });
  await t.test("keyset pagination is bounded, stable, filtered, and tenant-isolated", () => within("recommendation-a", () => {
    assert.throws(() => service.list({ limit: 101 }), /limit/);
    assert.throws(() => service.list({ status: "accepted" }), /unsupported/);
    assert.throws(() => service.list({ reviewPriority: "URGENT" }), /reviewPriority/);
    const first = service.list({ limit: 1, recommendationType: "attention_evidence_review" }); assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
    const second = service.list({ limit: 1, recommendationType: "attention_evidence_review", cursor: first.nextCursor }); assert.equal(second.items.length, 1); assert.notEqual(first.items[0].id, second.items[0].id);
    assert.throws(() => service.list({ cursor: "bad!" }), /cursor/); assert.throws(() => service.list({ cursor: encodeCursor("semantic_findings", { calculatedAt: AT, id: "x" }) }), /cursor/);
    assert.equal(within("recommendation-b", () => service.list({ limit: 100 }).items.length), 0); assert.throws(() => within("recommendation-b", () => service.get(firstRecommendation.id)), /not found/);
  }));
  await t.test("HTTP exposes only calculate/list/detail recommendation routes", async () => {
    const app = express(); app.use(express.json()); app.use((req, res, next) => { req.user = { id: "u" }; runWithWorkspace(req.headers["x-test-workspace"] || "recommendation-a", next); }); app.use("/api", createRecommendationIntelligenceRouter({ service }));
    let server;
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/intelligence/recommendations?limit=1`)).status, 200);
    assert.equal((await fetch(`${base}/api/intelligence/recommendations/${firstRecommendation.id}`, { headers: { "x-test-workspace": "recommendation-b" } })).status, 404);
    assert.equal((await fetch(`${base}/api/intelligence/recommendations/execute`, { method: "POST" })).status, 404);
    await new Promise((resolve) => server.close(resolve));
  });
  await t.test("query plan uses tenant-leading pagination index and metrics contain no content", () => {
    const plan = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM intelligence_recommendations WHERE workspace_id=? ORDER BY calculated_at DESC,id DESC LIMIT 51").all("recommendation-a");
    assert.ok(plan.some((row) => row.detail.includes("idx_intelligence_recommendations_page")));
    const serialized = JSON.stringify(metrics.recent()); for (const forbidden of ["brand-monitor", "rationaleCode", "semanticFindingReferences", "context"]) assert.equal(serialized.includes(forbidden), false);
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
  });
  db.close(); rmSync(dir, { recursive: true, force: true });
});
