import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { contextCapabilityRegistry } from "../app/context-consumers/capability-registry.mjs";
import { createBusinessContextConsumerGateway } from "../app/context-consumers/business-context-consumer-gateway.mjs";
import { createCartFeatureProducer } from "../app/feature-producers/cart-feature-producer.mjs";
import { createFeatureRegistry, featureRegistry } from "../app/features/feature-registry.mjs";
import { eventTypeRegistry } from "../app/events/event-type-registry.mjs";
import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createBrandBookRepository } from "../app/repositories/brand-book-repository.mjs";
import { createBusinessContextRepository } from "../app/repositories/business-context-repository.mjs";
import { createBusinessContextUsageRepository } from "../app/repositories/business-context-usage-repository.mjs";
import { createBusinessDnaRepository } from "../app/repositories/business-dna-repository.mjs";
import { createBusinessEventRepository } from "../app/repositories/business-event-repository.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createFeatureValueRepository } from "../app/repositories/feature-value-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createIntelligenceRecordRepository } from "../app/repositories/intelligence-record-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBrandBookRouter } from "../app/routes/brand-book.mjs";
import { createBusinessContextRouter } from "../app/routes/business-context.mjs";
import { createBusinessDnaRouter } from "../app/routes/business-dna.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createFeatureValueRouter } from "../app/routes/feature-values.mjs";
import { createIntelligenceDataRouter } from "../app/routes/intelligence-data.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createCartAbandonmentSignalProducer } from "../app/signal-producers/cart-abandonment-signal-producer.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createBrandBookService } from "../app/services/brand-book-service.mjs";
import { createBusinessContextService } from "../app/services/business-context-service.mjs";
import { createBusinessDnaService } from "../app/services/business-dna-service.mjs";
import { createBusinessEventService } from "../app/services/business-event-service.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
import { createFeatureQueryService } from "../app/services/feature-query-service.mjs";
import { createIntelligenceQueryService } from "../app/services/intelligence-query-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";
import { migration005BusinessProfiles } from "../db/migrations/005_business_profiles.mjs";
import { migration006BusinessDnaVersions } from "../db/migrations/006_business_dna_versions.mjs";
import { migration007BusinessDnaImmutability } from "../db/migrations/007_business_dna_immutability.mjs";
import { migration008BrandBookVersions } from "../db/migrations/008_brand_book_versions.mjs";
import { migration009BrandBookImmutability } from "../db/migrations/009_brand_book_immutability.mjs";
import { migration010BusinessContextVersions } from "../db/migrations/010_business_context_versions.mjs";
import { migration011BusinessContextImmutability } from "../db/migrations/011_business_context_immutability.mjs";
import { migration012BusinessContextLifecycleGuards } from "../db/migrations/012_business_context_lifecycle_guards.mjs";
import { migration013BusinessContextUsage } from "../db/migrations/013_business_context_usage.mjs";
import { migration014BusinessEventsObservationsSignals } from "../db/migrations/014_business_events_observations_signals.mjs";
import { migration015IntelligenceDataGuards } from "../db/migrations/015_intelligence_data_guards.mjs";
import { migration016FeatureValues } from "../db/migrations/016_feature_values.mjs";
import { migration017FeatureValueGuards } from "../db/migrations/017_feature_value_guards.mjs";

test("Phase 3C deterministic Feature foundation", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-features-"));
  const db = new Database(join(directory, "features.sqlite"));
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE customers (id TEXT PRIMARY KEY, workspace_id TEXT); CREATE TABLE marketing_campaigns (id TEXT PRIMARY KEY, workspace_id TEXT);");
  const migrationList = [
    migration001Identity, migration004WorkspaceManagementAudit, migration005BusinessProfiles,
    migration006BusinessDnaVersions, migration007BusinessDnaImmutability,
    migration008BrandBookVersions, migration009BrandBookImmutability,
    migration010BusinessContextVersions, migration011BusinessContextImmutability,
    migration012BusinessContextLifecycleGuards, migration013BusinessContextUsage,
    migration014BusinessEventsObservationsSignals, migration015IntelligenceDataGuards,
    migration016FeatureValues, migration017FeatureValueGuards,
  ];
  runMigrations(db, migrationList); runMigrations(db, migrationList);

  let nowMs = Date.parse("2026-08-21T14:00:00.000Z");
  const now = () => new Date((nowMs += 1000));
  const identities = createIdentityRepository(db);
  const authService = createAuthService({ repository: identities, otpHashSecret: "features-test-secret" });
  const profileService = createBusinessProfileService({ repository: createBusinessProfileRepository(db), auditRepository: identities, now });
  const dnaService = createBusinessDnaService({ repository: createBusinessDnaRepository(db), auditRepository: identities, now });
  const brandService = createBrandBookService({ repository: createBrandBookRepository(db), auditRepository: identities, now });
  const contextService = createBusinessContextService({ repository: createBusinessContextRepository(db), auditRepository: identities, now });
  const gateway = createBusinessContextConsumerGateway({
    businessContextService: contextService, usageRepository: createBusinessContextUsageRepository(db),
    capabilityRegistry: contextCapabilityRegistry, now,
  });
  const eventRepository = createBusinessEventRepository(db);
  const intelligenceRepository = createIntelligenceRecordRepository(db);
  const featureRepository = createFeatureValueRepository(db);
  const featureProducer = createCartFeatureProducer({ contextGateway: gateway, featureRegistry, repository: featureRepository, now });
  const signalProducer = createCartAbandonmentSignalProducer({
    contextGateway: gateway, repository: intelligenceRepository, featureProducer, now,
  });
  const eventService = createBusinessEventService({
    repository: eventRepository, eventRegistry: eventTypeRegistry, contextGateway: gateway, signalProducer, now,
  });
  const featureQueryService = createFeatureQueryService({ repository: featureRepository, now });

  const app = express(); app.use(express.json());
  app.use("/api/auth", createAuthRouter({ authService, nodeEnv: "test", exposeDevelopmentOtp: true }));
  app.use(createRequireAuth(authService));
  app.use("/api/workspaces", createWorkspaceRouter({ authService }));
  app.use(createRequireWorkspace(identities));
  app.use((req, res, next) => runWithWorkspace(req.workspace.id, next));
  app.use("/api/business-profile", createBusinessProfileRouter({ businessProfileService: profileService }));
  app.use("/api/business-dna", createBusinessDnaRouter({ businessDnaService: dnaService }));
  app.use("/api/brand-book", createBrandBookRouter({ brandBookService: brandService }));
  app.use("/api/business-context", createBusinessContextRouter({ businessContextService: contextService }));
  app.use("/api", createIntelligenceDataRouter({
    businessEventService: eventService,
    intelligenceQueryService: createIntelligenceQueryService({ repository: intelligenceRepository }),
  }));
  app.use("/api", createFeatureValueRouter({ featureQueryService }));

  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, options);
  async function register(mobile, name) {
    let response = await request("/api/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, name }) });
    const sent = await response.json();
    response = await request("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, code: sent.developmentOtp }) });
    return { data: await response.json(), cookie: response.headers.get("set-cookie").split(";")[0] };
  }
  const userA = await register("09125550001", "Features A");
  const userB = await register("09125550002", "Features B");
  const headersA = { Cookie: userA.cookie, "Content-Type": "application/json" };
  const headersB = { Cookie: userB.cookie, "Content-Type": "application/json" };
  const post = (path, headers, body = {}) => request(path, { method: "POST", headers, body: JSON.stringify(body) });
  const cartEvent = (key, subjectId = "cart-feature-1") => ({
    eventType: "cart.abandoned", occurredAt: "2026-08-20T14:00:00.000Z",
    actorType: "customer", subjectType: "cart", subjectId,
    sourceType: "shopify", sourceId: "feature-store", idempotencyKey: key,
    correlationId: "feature-journey", properties: { cartId: subjectId, totalAmount: 4500000, currency: "IRR" },
  });
  async function establishContext(headers, name) {
    await post("/api/business-profile", headers, { name, industry: "Commerce" });
    let version = (await (await post("/api/business-dna/versions", headers, { valueProposition: "Recover revenue", goals: ["Grow"] })).json()).version;
    await post(`/api/business-dna/versions/${version.id}/activate`, headers);
    version = (await (await post("/api/brand-book/versions", headers, { toneOfVoice: "Helpful" })).json()).version;
    await post(`/api/brand-book/versions/${version.id}/activate`, headers);
    version = (await (await post("/api/business-context/versions", headers)).json()).version;
    return (await (await post(`/api/business-context/versions/${version.id}/activate`, headers)).json()).version;
  }

  await t.test("migration is idempotent and feature APIs require authentication", async () => {
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version IN (16,17)").get().count, 2);
    assert.equal((await request("/api/features")).status, 401);
    assert.equal((await request("/api/feature-set/cart/cart-feature-1")).status, 401);
  });

  await t.test("Feature Registry validates definitions", () => {
    const baseDefinition = featureRegistry.get("cart_abandoned_value", 1);
    assert.throws(() => createFeatureRegistry([baseDefinition, baseDefinition]), /Duplicate/);
    assert.throws(() => createFeatureRegistry([{ ...baseDefinition, featureName: "bad_type", valueType: "embedding" }]), /unknown value type/);
    assert.throws(() => createFeatureRegistry([{ ...baseDefinition, featureName: "bad_subject", subjectType: "anything" }]), /invalid subject type/);
    assert.throws(() => createFeatureRegistry([{ ...baseDefinition, featureName: "bad_schema", supportedContextSchemaVersions: ["9.0"] }]), /unsupported context schema/);
    assert.throws(() => createFeatureRegistry([{ ...baseDefinition, featureName: "bad_freshness", freshnessPolicy: { mode: "magic" } }]), /freshness/);
    assert.throws(() => createFeatureRegistry([{ ...baseDefinition, featureName: "bad_sources", requiredObservationTypes: [], requiredSignalTypes: [] }]), /upstream source/);
  });

  await t.test("missing context preserves event and produces no intelligence chain", async () => {
    const response = await post("/api/events/ingest", headersA, cartEvent("feature-missing", "cart-missing"));
    const data = await response.json();
    assert.equal(data.event.contextVersionId, null);
    assert.equal(data.derivation.state, "MISSING_CONTEXT");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM feature_values").get().count, 0);
  });

  let contextA;
  let chain;
  await t.test("numeric, boolean, and categorical Features use exact canonical sources", async () => {
    contextA = await establishContext(headersA, "Feature Business A");
    const response = await post("/api/events/ingest", headersA, cartEvent("feature-ready"));
    assert.equal(response.status, 201);
    chain = await response.json();
    assert.equal(chain.derivation.features.length, 3);
    const byName = Object.fromEntries(chain.derivation.features.map((feature) => [feature.featureName, feature]));
    assert.equal(byName.cart_abandoned_value.valueType, "numeric");
    assert.equal(byName.cart_abandoned_value.value, 4500000);
    assert.equal(byName.cart_recovery_opportunity_active.valueType, "boolean");
    assert.equal(byName.cart_recovery_opportunity_active.value, true);
    assert.equal(byName.cart_recovery_value_band.valueType, "categorical");
    assert.equal(byName.cart_recovery_value_band.value, "medium");
    for (const feature of chain.derivation.features) {
      assert.equal(feature.contextVersionId, contextA.id);
      assert.equal(feature.subjectId, "cart-feature-1");
      assert.equal(Object.hasOwn(feature, "recommendation"), false);
      assert.equal(Object.hasOwn(feature, "action"), false);
    }
    assert.deepEqual(byName.cart_abandoned_value.sourceObservationIds, [chain.derivation.observation.id]);
    assert.deepEqual(byName.cart_recovery_opportunity_active.sourceSignalIds, [chain.derivation.signal.id]);
    assert.equal(byName.cart_recovery_value_band.provenance.calculationMetadata.currency, "IRR");
    assert.equal(byName.cart_recovery_value_band.provenance.calculationMetadata.crossCurrencyComparable, false);
  });

  await t.test("reproduction and duplicate ingestion reuse Feature records", async () => {
    const ids = chain.derivation.features.map((feature) => feature.id).sort();
    const reproduced = runWithWorkspace(userA.data.activeWorkspace.id, () => signalProducer.produce(chain.event, { userId: userA.data.user.id }));
    assert.deepEqual(reproduced.features.map((feature) => feature.id).sort(), ids);
    const duplicate = await (await post("/api/events/ingest", headersA, cartEvent("feature-ready"))).json();
    assert.equal(duplicate.duplicate, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM feature_values").get().count, 3);
  });

  await t.test("Feature Values are immutable and deletion is blocked", () => {
    const id = chain.derivation.features[0].id;
    assert.throws(() => db.prepare("UPDATE feature_values SET numeric_value=1 WHERE id=?").run(id));
    assert.throws(() => db.prepare("DELETE FROM feature_values WHERE id=?").run(id));
  });

  await t.test("Feature Set and read APIs retain versions, values, and provenance", async () => {
    let response = await request("/api/feature-set/cart/cart-feature-1", { headers: headersA });
    const set = (await response.json()).featureSet;
    assert.equal(set.contextVersionId, contextA.id);
    assert.equal(set.features.cart_abandoned_value.featureVersion, 1);
    assert.equal(set.features.cart_abandoned_value.value, 4500000);
    assert.deepEqual(set.features.cart_abandoned_value.sourceObservationIds, [chain.derivation.observation.id]);
    assert.equal(set.features.cart_recovery_opportunity_active.value, true);
    assert.equal(Object.hasOwn(set, "recommendation"), false);
    response = await request(`/api/features/${chain.derivation.features[0].id}`, { headers: headersB });
    assert.equal(response.status, 404);
    const listB = await (await request("/api/features", { headers: headersB })).json();
    assert.equal(listB.features.length, 0);
  });

  await t.test("freshness is derived without mutating historical Features", async () => {
    let list = await (await request("/api/features?freshOnly=true", { headers: headersA })).json();
    assert.equal(list.features.length, 3);
    nowMs += 8 * 24 * 60 * 60 * 1000;
    list = await (await request("/api/features", { headers: headersA })).json();
    assert.ok(list.features.every((feature) => feature.freshness === "expired"));
    const fresh = await (await request("/api/features?freshOnly=true", { headers: headersA })).json();
    assert.equal(fresh.features.length, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM feature_values").get().count, 3);
  });

  await t.test("database rejects cross-workspace and wrong-subject sources", () => {
    const observation = chain.derivation.observation;
    assert.throws(() => db.prepare(`INSERT INTO feature_values (
      id,workspace_id,feature_name,feature_version,subject_type,subject_id,context_version_id,
      window_start,window_end,value_type,numeric_value,calculated_at,producer,producer_version,
      producer_key,source_observation_ids_json,source_signal_ids_json,provenance_json,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,'numeric',?,?,?,?,?,?,?,'{}',?)`).run(
      crypto.randomUUID(), userB.data.activeWorkspace.id, "cross", 1, "cart", "cart-feature-1",
      contextA.id, observation.windowStart, observation.windowEnd, 1, now().toISOString(),
      "test", "1", "cross", JSON.stringify([observation.id]), "[]", now().toISOString()
    ));
    assert.throws(() => db.prepare(`INSERT INTO feature_values (
      id,workspace_id,feature_name,feature_version,subject_type,subject_id,context_version_id,
      window_start,window_end,value_type,numeric_value,calculated_at,producer,producer_version,
      producer_key,source_observation_ids_json,source_signal_ids_json,provenance_json,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,'numeric',?,?,?,?,?,?,?,'{}',?)`).run(
      crypto.randomUUID(), userA.data.activeWorkspace.id, "wrong-subject", 1, "cart", "other-cart",
      contextA.id, observation.windowStart, observation.windowEnd, 1, now().toISOString(),
      "test", "1", "wrong-subject", JSON.stringify([observation.id]), "[]", now().toISOString()
    ));
  });

  await t.test("stale context preserves Event and blocks Observation/Signal/Feature production", async () => {
    await request("/api/business-profile", { method: "PATCH", headers: headersA, body: JSON.stringify({ city: "Shiraz" }) });
    const counts = db.prepare(`SELECT
      (SELECT COUNT(*) FROM normalized_observations) observations,
      (SELECT COUNT(*) FROM derived_signals) signals,
      (SELECT COUNT(*) FROM feature_values) features`).get();
    const data = await (await post("/api/events/ingest", headersA, cartEvent("feature-stale", "cart-stale"))).json();
    assert.equal(data.derivation.state, "STALE_CONTEXT");
    assert.equal(data.event.contextVersionId, null);
    assert.deepEqual(db.prepare(`SELECT
      (SELECT COUNT(*) FROM normalized_observations) observations,
      (SELECT COUNT(*) FROM derived_signals) signals,
      (SELECT COUNT(*) FROM feature_values) features`).get(), counts);
  });

  await t.test("feature failure rolls back the complete Observation/Signal/Feature chain", () => {
    const failingSignalProducer = createCartAbandonmentSignalProducer({
      contextGateway: gateway, repository: intelligenceRepository,
      featureProducer: { produce() { throw new Error("simulated feature database failure"); } }, now,
    });
    const failingService = createBusinessEventService({
      repository: eventRepository, eventRegistry: eventTypeRegistry,
      contextGateway: gateway, signalProducer: failingSignalProducer, now,
    });
    const before = db.prepare(`SELECT
      (SELECT COUNT(*) FROM business_events) events,
      (SELECT COUNT(*) FROM normalized_observations) observations,
      (SELECT COUNT(*) FROM derived_signals) signals,
      (SELECT COUNT(*) FROM feature_values) features`).get();
    // Restore source freshness only for this isolated atomicity check by using the immutable
    // context-bound sources directly through a gateway stub; application behavior remains stale-safe.
    const readyGateway = { consume: () => ({ state: "READY", contextVersionId: contextA.id }) };
    const atomicProducer = createCartAbandonmentSignalProducer({
      contextGateway: readyGateway, repository: intelligenceRepository,
      featureProducer: { produce() { throw new Error("simulated feature database failure"); } }, now,
    });
    const atomicService = createBusinessEventService({
      repository: eventRepository, eventRegistry: eventTypeRegistry,
      contextGateway: readyGateway, signalProducer: atomicProducer, now,
    });
    assert.throws(() => runWithWorkspace(userA.data.activeWorkspace.id, () =>
      atomicService.ingest(cartEvent("feature-atomic-failure", "cart-atomic"), userA.data.user.id)), /simulated/);
    const after = db.prepare(`SELECT
      (SELECT COUNT(*) FROM business_events) events,
      (SELECT COUNT(*) FROM normalized_observations) observations,
      (SELECT COUNT(*) FROM derived_signals) signals,
      (SELECT COUNT(*) FROM feature_values) features`).get();
    assert.equal(after.events, before.events + 1);
    assert.equal(after.observations, before.observations);
    assert.equal(after.signals, before.signals);
    assert.equal(after.features, before.features);
    assert.ok(failingService);
  });

  await t.test("feature producers obey architecture boundaries", () => {
    const output = execFileSync(process.execPath, [join(import.meta.dirname, "../scripts/check-db-boundaries.mjs")], { encoding: "utf8" });
    assert.match(output, /Business Context consumer boundary is valid/);
  });

  await t.test("SQLite integrity and foreign keys remain valid", () => {
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });

  await new Promise((resolve) => server.close(resolve)); db.close();
  rmSync(directory, { recursive: true, force: true });
});
