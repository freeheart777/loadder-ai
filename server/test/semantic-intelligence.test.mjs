import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import express from "express";

import { runMigrations } from "../db/migrate.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { semanticContractRegistry } from "../app/semantic/semantic-contract-registry.mjs";
import { produceListeningAttention, produceCompetitiveVisibility } from "../app/semantic/semantic-producers.mjs";
import { createSemanticFindingRepository } from "../app/repositories/semantic-finding-repository.mjs";
import { createSemanticIntelligenceService } from "../app/services/semantic-intelligence-service.mjs";
import { createSemanticIntelligenceRouter } from "../app/routes/semantic-intelligence.mjs";
import { encodeCursor } from "../app/query/cursor-pagination.mjs";
import { createOperationMetrics } from "../app/observability/operation-metrics.mjs";

const AT = "2026-08-21T12:00:00.000Z";
const START = "2026-08-20T12:00:00.000Z";
const contextSnapshot = JSON.stringify({ identity: {}, metadata: {} });

test("Phase 4E v1 Semantic Intelligence foundation", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "loadder-semantic-")), path = join(dir, "semantic.sqlite");
  copyFileSync(new URL("../db/loadder.sqlite", import.meta.url), path);
  const db = new Database(path); db.pragma("foreign_keys=ON"); runMigrations(db); runMigrations(db);
  for (const workspace of ["semantic-a", "semantic-b"]) {
    db.prepare("INSERT INTO workspaces(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)").run(workspace, workspace, workspace, AT, AT);
    db.prepare("INSERT INTO business_profiles(id,workspace_id,name,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(`p-${workspace}`, workspace, workspace, "active", AT, AT);
    db.prepare("INSERT INTO business_dna_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`d-${workspace}`, workspace, `p-${workspace}`, 1, "active", AT, AT);
    db.prepare("INSERT INTO brand_book_versions(id,workspace_id,business_profile_id,version_number,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`b-${workspace}`, workspace, `p-${workspace}`, 1, "active", AT, AT);
    db.prepare(`INSERT INTO business_context_versions(id,workspace_id,business_profile_id,business_dna_version_id,brand_book_version_id,version_number,status,context_schema_version,snapshot_json,source_manifest_json,created_at,activated_at) VALUES(?,?,?,?,?,1,'active','1.0',?,'{}',?,?)`).run(`c-${workspace}`, workspace, `p-${workspace}`, `d-${workspace}`, `b-${workspace}`, contextSnapshot, AT, AT);
  }
  const aggregate = ({ id, workspace = "semantic-a", metric, value, numerator = null, denominator = null, state = "available", context = `c-${workspace}`, entitySet = { brands: ["Loadder"], competitors: ["Rival"] }, at = AT }) => db.prepare(`INSERT INTO listening_aggregates(id,workspace_id,metric_type,metric_version,window_policy,window_start,window_end,point_in_time_cutoff,calculated_at,state,numeric_value,numerator,denominator,source_record_count,source_manifest_json,context_version_id,producer,producer_version,producer_key,provenance_json) VALUES(?,?,?,1,'24h',?,?,?,?,?,?,?,?,0,'{"recordIds":[]}',?,'listening_intelligence','1.0',?,?)`).run(id, workspace, metric, START, AT, AT, at, state, value, numerator, denominator, context, `key-${id}`, JSON.stringify({ entitySet }));
  aggregate({ id: "mention-a", metric: "mention_count", value: 4 });
  aggregate({ id: "sov-a", metric: "share_of_voice", value: .75, numerator: 3, denominator: 4 });
  aggregate({ id: "competitor-a", metric: "competitor_mention_count", value: 1 });
  db.prepare(`INSERT INTO listening_trend_signals(id,workspace_id,signal_type,signal_version,current_aggregate_id,baseline_aggregate_id,state,severity,current_value,baseline_value,absolute_delta,relative_delta,confidence_reason,window_start,window_end,calculated_at,context_version_id,producer,producer_version,producer_key,provenance_json) VALUES('trend-a','semantic-a','mention_volume_rising',1,'mention-a',NULL,'rising','medium',4,2,2,1,'DETERMINISTIC_THRESHOLD_NO_STATISTICAL_CONFIDENCE',?,?,?,'c-semantic-a','listening_trend','1.0','trend-key','{}')`).run(START, AT, AT);
  db.prepare(`INSERT INTO listening_anomaly_results(id,workspace_id,metric_type,aggregate_id,state,score,baseline_center,dispersion,current_value,sample_count,method,method_version,baseline_window_end,calculated_at,explanation,producer_key,provenance_json) VALUES('anomaly-a','semantic-a','mention_count','mention-a','elevated',2,1,1,4,4,'median_mad',1,?,?, 'elevated','anomaly-key','{}')`).run(START, AT);

  const contexts = new Map([["semantic-a", "c-semantic-a"], ["semantic-b", "c-semantic-b"]]);
  const metrics = createOperationMetrics({ limit: 20 });
  const gateway = { consume: () => ({ state: "READY", contextVersionId: contexts.get(activeWorkspace), context: { identity: {}, metadata: {} } }) };
  let activeWorkspace = "semantic-a";
  const repository = createSemanticFindingRepository(db);
  const service = createSemanticIntelligenceService({ repository, registry: semanticContractRegistry, contextGateway: gateway, now: () => new Date(AT), operationMetrics: metrics });
  const within = (workspace, work) => { activeWorkspace = workspace; return runWithWorkspace(workspace, work); };

  await t.test("migration 035 is idempotent and minimal", () => {
    assert.equal(db.prepare("SELECT COUNT(*) c FROM schema_migrations WHERE version=35 AND name='semantic_findings'").get().c, 1);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='semantic_findings'").get().c, 1);
  });
  await t.test("registry contains exactly the approved contracts", () => {
    assert.deepEqual(semanticContractRegistry.list().map((x) => x.semanticType), ["listening_attention_state", "competitive_visibility_state"]);
    assert.equal(semanticContractRegistry.get("sentiment"), null);
  });
  await t.test("pure producers use actual Phase 4D states", () => {
    assert.equal(produceListeningAttention({ mention: { state: "available" }, trend: { state: "rising" }, anomaly: { state: "elevated" } }).state, "SURGING");
    assert.equal(produceListeningAttention({ mention: { state: "available" }, trend: { state: "falling" } }).state, "FALLING");
    assert.equal(produceListeningAttention({ mention: { state: "available" }, trend: { state: "insufficient_data" } }).state, "INSUFFICIENT_EVIDENCE");
    assert.equal(produceCompetitiveVisibility({ shareOfVoice: { state: "available", numerator: 2, denominator: 4, provenance: { entitySet: { competitors: ["Rival"] } } }, competitorMentions: { state: "available", value: 2 } }).state, "PARITY");
    assert.equal(produceCompetitiveVisibility({ shareOfVoice: { state: "unavailable", provenance: {} }, competitorMentions: null }).state, "INSUFFICIENT_EVIDENCE");
  });
  let attention, competitive;
  await t.test("calculations are deterministic, provenance-backed, and confidence-free", () => within("semantic-a", () => {
    const response = service.calculate({ semanticTypes: ["listening_attention_state", "competitive_visibility_state"], subjectType: "listening_scope", subjectKey: "brand-monitor", pointInTimeCutoff: AT, window: "24h" }, "user-a");
    [attention, competitive] = response.findings;
    assert.equal(response.reusedResult, false); assert.equal(attention.state, "SURGING"); assert.equal(competitive.state, "LEADING");
    assert.equal(attention.confidence, null); assert.equal(attention.contextVersionId, "c-semantic-a");
    assert.equal(attention.evidenceCount, 3); assert.match(attention.evidenceManifestHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(attention.evidenceReferences, [...attention.evidenceReferences].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)));
    assert.equal(attention.provenance.factualInterpretationOnly, true);
    for (const forbidden of ["recommendation", "decision", "action", "prediction", "rawText", "prompt"]) assert.equal(JSON.stringify(response).toLowerCase().includes(forbidden.toLowerCase()), false);
  }));
  await t.test("exact reuse writes zero findings", () => within("semantic-a", () => {
    const before = db.prepare("SELECT COUNT(*) c FROM semantic_findings").get().c;
    const response = service.calculate({ semanticTypes: ["listening_attention_state", "competitive_visibility_state"], subjectType: "listening_scope", subjectKey: "brand-monitor", pointInTimeCutoff: AT, window: "24h" }, "user-a");
    assert.equal(response.reusedResult, true); assert.equal(db.prepare("SELECT COUNT(*) c FROM semantic_findings").get().c, before);
    const measurement = metrics.recent().at(-1); assert.equal(measurement.rowsWritten, 0); assert.equal(measurement.reusedResult, true); assert.equal(JSON.stringify(measurement).includes("brand-monitor"), false);
  }));
  await t.test("Context and producer/contract identity invalidate reuse", () => within("semantic-a", () => {
    const missingService = createSemanticIntelligenceService({ repository, registry: semanticContractRegistry, contextGateway: { consume: () => ({ state: "MISSING_CONTEXT", contextVersionId: null }) }, now: () => new Date(AT) });
    assert.throws(() => missingService.calculate({ semanticTypes: ["listening_attention_state"], subjectType: "listening_scope", subjectKey: "missing-context", pointInTimeCutoff: AT, window: "24h" }), /MISSING_CONTEXT/);
    const original = semanticContractRegistry.get("listening_attention_state");
    for (const changed of [{ semanticVersion: 2 }, { producerVersion: "2.0" }]) {
      const revised = Object.freeze({ ...original, ...changed });
      const revisedRegistry = { get: (type) => type === revised.semanticType ? revised : semanticContractRegistry.get(type) };
      const revisedService = createSemanticIntelligenceService({ repository, registry: revisedRegistry, contextGateway: gateway, now: () => new Date(AT) });
      const response = revisedService.calculate({ semanticTypes: ["listening_attention_state"], subjectType: "listening_scope", subjectKey: "brand-monitor", pointInTimeCutoff: AT, window: "24h" });
      assert.equal(response.reusedResult, false); assert.notEqual(response.findings[0].id, attention.id);
    }
  }));
  await t.test("new canonical evidence and Context versions invalidate reuse", () => within("semantic-a", () => {
    aggregate({ id: "mention-a2", metric: "mention_count", value: 5, at: "2026-08-21T12:00:01.000Z" });
    db.prepare(`INSERT INTO listening_trend_signals(id,workspace_id,signal_type,signal_version,current_aggregate_id,state,severity,current_value,baseline_value,absolute_delta,relative_delta,confidence_reason,window_start,window_end,calculated_at,context_version_id,producer,producer_version,producer_key,provenance_json) VALUES('trend-a2','semantic-a','mention_volume_rising',1,'mention-a2','rising','medium',5,4,1,.25,'DETERMINISTIC_THRESHOLD_NO_STATISTICAL_CONFIDENCE',?,?,?,'c-semantic-a','listening_trend','1.0','trend-key-2','{}')`).run(START, AT, "2026-08-21T12:00:01.000Z");
    const changedEvidence = service.calculate({ semanticTypes: ["listening_attention_state"], subjectType: "listening_scope", subjectKey: "brand-monitor", pointInTimeCutoff: AT, window: "24h" });
    assert.equal(changedEvidence.reusedResult, false); assert.notEqual(changedEvidence.findings[0].id, attention.id);
    db.prepare(`INSERT INTO business_context_versions(id,workspace_id,business_profile_id,business_dna_version_id,brand_book_version_id,version_number,status,context_schema_version,snapshot_json,source_manifest_json,created_at,archived_at) VALUES('c-semantic-a2','semantic-a','p-semantic-a','d-semantic-a','b-semantic-a',2,'archived','1.0',?,'{}',?,?)`).run(contextSnapshot, AT, AT);
    aggregate({ id: "mention-a3", metric: "mention_count", value: 6, context: "c-semantic-a2", at: "2026-08-21T12:00:02.000Z" });
    db.prepare(`INSERT INTO listening_trend_signals(id,workspace_id,signal_type,signal_version,current_aggregate_id,state,severity,current_value,baseline_value,absolute_delta,relative_delta,confidence_reason,window_start,window_end,calculated_at,context_version_id,producer,producer_version,producer_key,provenance_json) VALUES('trend-a3','semantic-a','mention_volume_rising',1,'mention-a3','rising','medium',6,5,1,.2,'DETERMINISTIC_THRESHOLD_NO_STATISTICAL_CONFIDENCE',?,?,?,'c-semantic-a2','listening_trend','1.0','trend-key-3','{}')`).run(START, AT, "2026-08-21T12:00:02.000Z");
    contexts.set("semantic-a", "c-semantic-a2");
    const changedContext = service.calculate({ semanticTypes: ["listening_attention_state"], subjectType: "listening_scope", subjectKey: "brand-monitor", pointInTimeCutoff: AT, window: "24h" });
    assert.equal(changedContext.reusedResult, false); assert.equal(changedContext.findings[0].contextVersionId, "c-semantic-a2");
  }));
  await t.test("identity changes create immutable history", () => within("semantic-a", () => {
    const response = service.calculate({ semanticTypes: ["listening_attention_state"], subjectType: "listening_scope", subjectId: "scope-2", subjectKey: "other-scope", pointInTimeCutoff: AT, window: "24h" });
    assert.notEqual(response.findings[0].id, attention.id); assert.throws(() => db.prepare("UPDATE semantic_findings SET state='STABLE' WHERE id=?").run(attention.id)); assert.throws(() => db.prepare("DELETE FROM semantic_findings WHERE id=?").run(attention.id));
  }));
  await t.test("database rejects foreign evidence and Context", () => within("semantic-b", () => {
    const columns = `id,workspace_id,semantic_type,semantic_version,schema_version,subject_type,subject_key,state,evidence_manifest_json,evidence_manifest_hash,evidence_count,context_version_id,context_state,calculated_at,point_in_time_cutoff,producer,producer_version,producer_key,confidence_reason,provenance_json,created_at`;
    const values = ["attack", "semantic-b", "listening_attention_state", 1, 1, "listening_scope", "x", "STABLE", JSON.stringify([{ kind: "listening_aggregate", id: "mention-a" }]), "hash", 1, "c-semantic-b", "READY", AT, AT, "x", "1", "x", "NONE", "{}", AT];
    assert.throws(() => db.prepare(`INSERT INTO semantic_findings(${columns}) VALUES(${values.map(() => "?").join(",")})`).run(...values), /cross-workspace semantic evidence/);
    values[0] = "attack2"; values[8] = "[]"; values[10] = 0; values[11] = "c-semantic-a";
    assert.throws(() => db.prepare(`INSERT INTO semantic_findings(${columns}) VALUES(${values.map(() => "?").join(",")})`).run(...values), /cross-workspace semantic context/);
  }));
  await t.test("bounded keyset pages, filters, and tenant isolation", () => within("semantic-a", () => {
    assert.throws(() => service.list({ limit: 101 }), /limit/); const first = service.list({ limit: 1, semanticType: "listening_attention_state" }); assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
    const second = service.list({ limit: 1, semanticType: "listening_attention_state", cursor: first.nextCursor }); assert.equal(second.items.length, 1); assert.notEqual(first.items[0].id, second.items[0].id);
    assert.throws(() => service.list({ cursor: "invalid!" }), /cursor/); assert.throws(() => service.list({ cursor: encodeCursor("feature_values", { calculatedAt: AT, id: "x" }) }), /cursor/);
    assert.equal(within("semantic-b", () => service.list({ limit: 100 }).items.length), 0); assert.throws(() => within("semantic-b", () => service.get(attention.id)), /not found/);
  }));
  await t.test("client workspace ownership and future evidence are rejected", () => within("semantic-a", () => {
    assert.throws(() => service.calculate({ workspaceId: "semantic-b", semanticTypes: ["listening_attention_state"], subjectType: "listening_scope", subjectKey: "x", pointInTimeCutoff: AT, window: "24h" }), /server-resolved/);
    assert.throws(() => service.calculate({ semanticTypes: ["listening_attention_state"], subjectType: "listening_scope", subjectKey: "x", pointInTimeCutoff: "2026-08-20T00:00:00.000Z", window: "24h" }), /unavailable/);
  }));
  await t.test("HTTP contracts preserve status, cursor errors, and isolation", async () => {
    const app = express(); app.use(express.json()); app.use((req, res, next) => { req.user = { id: "u" }; const workspace = req.headers["x-test-workspace"] || "semantic-a"; runWithWorkspace(workspace, next); }); app.use("/api", createSemanticIntelligenceRouter({ service }));
    const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); }); const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/intelligence/semantic/findings?limit=1`, { headers: { "x-test-workspace": "semantic-a" } })).status, 200);
    assert.equal((await fetch(`${base}/api/intelligence/semantic/findings?cursor=bad!`, { headers: { "x-test-workspace": "semantic-a" } })).status, 400);
    assert.equal((await fetch(`${base}/api/intelligence/semantic/findings/${attention.id}`, { headers: { "x-test-workspace": "semantic-b" } })).status, 404);
    await new Promise((resolve) => server.close(resolve));
  });
  await t.test("integrity, foreign keys, and content-free operation metrics", () => {
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
    const serialized = JSON.stringify(metrics.recent()); for (const forbidden of ["Loadder", "Rival", "brand-monitor", "evidenceReferences"]) assert.equal(serialized.includes(forbidden), false);
  });
  db.close(); rmSync(dir, { recursive: true, force: true });
});
