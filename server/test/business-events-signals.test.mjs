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
import { eventTypeRegistry } from "../app/events/event-type-registry.mjs";
import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createBrandBookRepository } from "../app/repositories/brand-book-repository.mjs";
import { createBusinessContextRepository } from "../app/repositories/business-context-repository.mjs";
import { createBusinessContextUsageRepository } from "../app/repositories/business-context-usage-repository.mjs";
import { createBusinessDnaRepository } from "../app/repositories/business-dna-repository.mjs";
import { createBusinessEventRepository } from "../app/repositories/business-event-repository.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createIntelligenceRecordRepository } from "../app/repositories/intelligence-record-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBrandBookRouter } from "../app/routes/brand-book.mjs";
import { createBusinessContextRouter } from "../app/routes/business-context.mjs";
import { createBusinessDnaRouter } from "../app/routes/business-dna.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createIntelligenceDataRouter } from "../app/routes/intelligence-data.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createCartAbandonmentSignalProducer } from "../app/signal-producers/cart-abandonment-signal-producer.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createDevelopmentOtpDelivery } from "../app/auth/sms-ir-otp-delivery.mjs";
import { createBrandBookService } from "../app/services/brand-book-service.mjs";
import { createBusinessContextService } from "../app/services/business-context-service.mjs";
import { createBusinessDnaService } from "../app/services/business-dna-service.mjs";
import { createBusinessEventService } from "../app/services/business-event-service.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
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
import { createOperationMetrics } from "../app/observability/operation-metrics.mjs";
import { encodeCursor } from "../app/query/cursor-pagination.mjs";

test("Phase 3B unified Business Events, Observations, and Signals", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-events-signals-"));
  const db = new Database(join(directory, "events.sqlite"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE customers (id TEXT PRIMARY KEY, workspace_id TEXT);
    CREATE TABLE marketing_campaigns (id TEXT PRIMARY KEY, workspace_id TEXT);
  `);
  const migrationList = [
    migration001Identity, migration004WorkspaceManagementAudit, migration005BusinessProfiles,
    migration006BusinessDnaVersions, migration007BusinessDnaImmutability,
    migration008BrandBookVersions, migration009BrandBookImmutability,
    migration010BusinessContextVersions, migration011BusinessContextImmutability,
    migration012BusinessContextLifecycleGuards, migration013BusinessContextUsage,
    migration014BusinessEventsObservationsSignals, migration015IntelligenceDataGuards,
  ];
  runMigrations(db, migrationList);
  runMigrations(db, migrationList);

  let nowMs = Date.parse("2026-08-21T14:00:00.000Z");
  const now = () => new Date((nowMs += 1000));
  const identities = createIdentityRepository(db);
  const authService = createAuthService({ repository: identities, otpHashSecret: "events-test-secret", otpDelivery: createDevelopmentOtpDelivery() });
  const profileService = createBusinessProfileService({ repository: createBusinessProfileRepository(db), auditRepository: identities, now });
  const dnaService = createBusinessDnaService({ repository: createBusinessDnaRepository(db), auditRepository: identities, now });
  const brandService = createBrandBookService({ repository: createBrandBookRepository(db), auditRepository: identities, now });
  const contextService = createBusinessContextService({ repository: createBusinessContextRepository(db), auditRepository: identities, now });
  const gateway = createBusinessContextConsumerGateway({
    businessContextService: contextService,
    usageRepository: createBusinessContextUsageRepository(db),
    capabilityRegistry: contextCapabilityRegistry,
    now,
  });
  const eventRepository = createBusinessEventRepository(db);
  const intelligenceRepository = createIntelligenceRecordRepository(db);
  const signalProducer = createCartAbandonmentSignalProducer({ contextGateway: gateway, repository: intelligenceRepository, now });
  const operationMetrics = createOperationMetrics();
  const eventService = createBusinessEventService({
    repository: eventRepository, eventRegistry: eventTypeRegistry,
    contextGateway: gateway, signalProducer, now, operationMetrics,
  });
  const queryService = createIntelligenceQueryService({ repository: intelligenceRepository });

  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter({ authService, nodeEnv: "test", exposeDevelopmentOtp: true }));
  app.use(createRequireAuth(authService));
  app.use("/api/workspaces", createWorkspaceRouter({ authService }));
  app.use(createRequireWorkspace(identities));
  app.use((req, res, next) => runWithWorkspace(req.workspace.id, next));
  app.use("/api/business-profile", createBusinessProfileRouter({ businessProfileService: profileService }));
  app.use("/api/business-dna", createBusinessDnaRouter({ businessDnaService: dnaService }));
  app.use("/api/brand-book", createBrandBookRouter({ brandBookService: brandService }));
  app.use("/api/business-context", createBusinessContextRouter({ businessContextService: contextService }));
  app.use("/api", createIntelligenceDataRouter({ businessEventService: eventService, intelligenceQueryService: queryService }));

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, options);
  async function register(mobile, name) {
    let response = await request("/api/auth/send-otp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, name }),
    });
    const sent = await response.json();
    response = await request("/api/auth/verify-otp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, code: sent.developmentOtp }),
    });
    return { data: await response.json(), cookie: response.headers.get("set-cookie").split(";")[0] };
  }
  const userA = await register("09124440001", "Events A");
  const userB = await register("09124440002", "Events B");
  const headersA = { Cookie: userA.cookie, "Content-Type": "application/json" };
  const headersB = { Cookie: userB.cookie, "Content-Type": "application/json" };
  const post = (path, headers, body = {}) => request(path, { method: "POST", headers, body: JSON.stringify(body) });
  const cartPayload = (overrides = {}) => ({
    eventType: "cart.abandoned", occurredAt: "2026-08-01T10:00:00.000Z",
    actorType: "customer", actorId: "customer-external-1",
    subjectType: "cart", subjectId: "cart-external-1",
    sourceType: "shopify", sourceId: "store-1", channel: "website",
    sessionId: "session-1", correlationId: "journey-1", causationId: "checkout-event-1",
    idempotencyKey: "shopify-event-100", properties: { cartId: "cart-external-1", totalAmount: 4500000, currency: "IRR" },
    metadata: { provider: "shopify" }, ...overrides,
  });

  async function establishContext(headers, name) {
    await post("/api/business-profile", headers, { name, industry: "Commerce" });
    let version = (await (await post("/api/business-dna/versions", headers, {
      valueProposition: "Simple commerce", goals: ["Recover revenue"],
    })).json()).version;
    await post(`/api/business-dna/versions/${version.id}/activate`, headers);
    version = (await (await post("/api/brand-book/versions", headers, { toneOfVoice: "Helpful" })).json()).version;
    await post(`/api/brand-book/versions/${version.id}/activate`, headers);
    version = (await (await post("/api/business-context/versions", headers)).json()).version;
    return (await (await post(`/api/business-context/versions/${version.id}/activate`, headers)).json()).version;
  }

  await t.test("migrations are idempotent and APIs require authentication", async () => {
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version IN (14,15)").get().count, 2);
    assert.equal((await post("/api/events/ingest", { "Content-Type": "application/json" }, cartPayload())).status, 401);
    assert.equal((await request("/api/observations")).status, 401);
    assert.equal((await request("/api/signals")).status, 401);
  });

  await t.test("registry rejects unknown types, malformed schemas, and ownership fields", async () => {
    let response = await post("/api/events/ingest", headersA, { ...cartPayload(), eventType: "unknown.event" });
    assert.equal((await response.json()).code, "EVENT_SCHEMA_INVALID");
    response = await post("/api/events/ingest", headersA, cartPayload({ properties: { cartId: "cart-external-1" } }));
    assert.equal((await response.json()).code, "EVENT_SCHEMA_INVALID");
    response = await post("/api/events/ingest", headersA, cartPayload({ workspaceId: userB.data.activeWorkspace.id }));
    assert.equal((await response.json()).code, "EVENT_OWNERSHIP_FORBIDDEN");
  });

  await t.test("missing context preserves factual event but blocks derivation", async () => {
    const response = await post("/api/events/ingest", headersA, cartPayload({ idempotencyKey: "missing-context-1" }));
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.event.contextVersionId, null);
    assert.equal(data.event.metadata.ingestion.contextState, "MISSING_CONTEXT");
    assert.equal(data.derivation.state, "MISSING_CONTEXT");
    assert.equal(data.derivation.signal, null);
  });

  let contextA;
  let produced;
  await t.test("late event keeps event time and deterministically produces Observation and Signal", async () => {
    contextA = await establishContext(headersA, "Events Business A");
    const response = await post("/api/events/ingest", headersA, cartPayload());
    assert.equal(response.status, 201);
    produced = await response.json();
    assert.equal(produced.event.occurredAt, "2026-08-01T10:00:00.000Z");
    assert.ok(produced.event.ingestedAt > produced.event.occurredAt);
    assert.equal(produced.event.correlationId, "journey-1");
    assert.equal(produced.event.causationId, "checkout-event-1");
    assert.equal(produced.event.contextVersionId, contextA.id);
    assert.equal(produced.derivation.state, "PRODUCED");
    const observation = produced.derivation.observation;
    assert.equal(observation.numericValue, 4500000);
    assert.equal(observation.sourceEventCount, 1);
    assert.deepEqual(observation.sourceManifest.eventIds, [produced.event.id]);
    assert.equal(observation.windowStart, produced.event.occurredAt);
    const signal = produced.derivation.signal;
    assert.equal(signal.signalType, "cart_recovery_opportunity");
    assert.equal(signal.confidence, 1);
    assert.equal(signal.score, 1);
    assert.equal(signal.lifecycleStatus, "active");
    assert.deepEqual(signal.sourceObservationIds, [observation.id]);
    assert.deepEqual(signal.provenance.sourceEventIds, [produced.event.id]);
    assert.equal(signal.contextVersionId, contextA.id);
    for (const suffix of ["two", "three"]) {
      const extra = await post("/api/events/ingest", headersA, cartPayload({
        subjectId: `cart-${suffix}`, idempotencyKey: `shopify-event-${suffix}`,
        properties: { cartId: `cart-${suffix}`, totalAmount: 4500000, currency: "IRR" },
      }));
      assert.equal(extra.status, 201);
    }
  });

  await t.test("idempotent ingestion and producer reproduction return original records", async () => {
    const before = db.prepare("SELECT COUNT(*) AS count FROM business_events").get().count;
    const response = await post("/api/events/ingest", headersA, cartPayload());
    const duplicate = await response.json();
    assert.equal(response.status, 200);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.event.id, produced.event.id);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM business_events").get().count, before);
    const reproduced = runWithWorkspace(userA.data.activeWorkspace.id, () =>
      signalProducer.produce(produced.event, { userId: userA.data.user.id }));
    assert.equal(reproduced.observation.id, produced.derivation.observation.id);
    assert.equal(reproduced.signal.id, produced.derivation.signal.id);
  });

  await t.test("events and observations are immutable; signal lifecycle only moves forward", () => {
    assert.throws(() => db.prepare("UPDATE business_events SET event_type='changed' WHERE id=?").run(produced.event.id));
    assert.throws(() => db.prepare("DELETE FROM business_events WHERE id=?").run(produced.event.id));
    assert.throws(() => db.prepare("UPDATE normalized_observations SET numeric_value=1 WHERE id=?")
      .run(produced.derivation.observation.id));
    db.prepare("UPDATE derived_signals SET lifecycle_status='expired' WHERE id=?").run(produced.derivation.signal.id);
    assert.throws(() => db.prepare("UPDATE derived_signals SET lifecycle_status='active' WHERE id=?")
      .run(produced.derivation.signal.id));
  });

  await t.test("tenant reads and cross-workspace references are isolated", async () => {
    let response = await request(`/api/events/${produced.event.id}`, { headers: headersB });
    assert.equal(response.status, 404);
    response = await request("/api/events", { headers: headersB });
    assert.equal((await response.json()).events.length, 0);
    db.prepare("INSERT INTO customers (id,workspace_id) VALUES (?,?)").run("customer-b", userB.data.activeWorkspace.id);
    response = await post("/api/events/ingest", headersA, cartPayload({
      idempotencyKey: "cross-customer", customerId: "customer-b",
    }));
    assert.equal((await response.json()).code, "EVENT_REFERENCE_INVALID");
    assert.throws(() => db.prepare(`INSERT INTO normalized_observations (
      id,workspace_id,observation_type,observation_version,subject_type,subject_id,
      context_version_id,window_start,window_end,value_type,numeric_value,source_event_count,
      source_manifest_json,calculated_at,producer,producer_version,producer_key
    ) VALUES (?,?,?,?,?,?,?,?,?,'numeric',?,1,?,?,?,?,?)`).run(
      crypto.randomUUID(), userB.data.activeWorkspace.id, "invalid", 1, "cart", "x",
      contextA.id, produced.event.occurredAt, produced.event.occurredAt, 1,
      JSON.stringify({ eventIds: [produced.event.id] }), now().toISOString(), "test", "1", "cross"
    ));
  });

  await t.test("stale context preserves event but blocks new signals", async () => {
    await request("/api/business-profile", {
      method: "PATCH", headers: headersA, body: JSON.stringify({ city: "Shiraz" }),
    });
    const response = await post("/api/events/ingest", headersA, cartPayload({
      subjectId: "cart-stale", idempotencyKey: "stale-context-1",
      properties: { cartId: "cart-stale", totalAmount: 1000, currency: "IRR" },
    }));
    const data = await response.json();
    assert.equal(data.event.contextVersionId, null);
    assert.equal(data.event.metadata.ingestion.contextState, "STALE_CONTEXT");
    assert.equal(data.derivation.state, "STALE_CONTEXT");
  });

  await t.test("workspace switching exposes independent streams", async () => {
    const workspace = "events-second-workspace";
    const timestamp = now().toISOString();
    db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .run(workspace, "Events Second", "events-second", "active", timestamp, timestamp);
    db.prepare(`INSERT INTO workspace_memberships
      (id,workspace_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(crypto.randomUUID(), workspace, userA.data.user.id, "admin", "active", timestamp, timestamp);
    await post("/api/workspaces/active", headersA, { workspaceId: workspace });
    let response = await request("/api/events", { headers: headersA });
    assert.equal((await response.json()).events.length, 0);
    await post("/api/workspaces/active", headersA, { workspaceId: userA.data.activeWorkspace.id });
    response = await request("/api/events?type=cart.abandoned", { headers: headersA });
    assert.ok((await response.json()).events.length >= 3);
  });

  await t.test("query APIs expose factual provenance without recommendations", async () => {
    const observations = await (await request("/api/observations?type=cart.abandoned_value", { headers: headersA })).json();
    const signals = await (await request("/api/signals?type=cart_recovery_opportunity", { headers: headersA })).json();
    assert.equal(observations.observations.length, 3);
    assert.equal(signals.signals.length, 3);
    assert.equal(Object.hasOwn(signals.signals[0], "recommendation"), false);
    assert.equal(Object.hasOwn(signals.signals[0], "action"), false);
  });

  await t.test("Observation cursor pagination is stable with filters and tenant isolation", async () => {
    const complete = await (await request("/api/observations?type=cart.abandoned_value&limit=100", { headers: headersA })).json();
    const first = await (await request("/api/observations?type=cart.abandoned_value&limit=1", { headers: headersA })).json();
    assert.equal(first.observations.length, 1); assert.ok(first.nextCursor);
    const second = await (await request(`/api/observations?type=cart.abandoned_value&limit=1&cursor=${encodeURIComponent(first.nextCursor)}`, { headers: headersA })).json();
    assert.equal(new Set([...first.observations, ...second.observations].map((item) => item.id)).size, 2);
    assert.deepEqual([...first.observations, ...second.observations].map((item) => item.id), complete.observations.slice(0, 2).map((item) => item.id));
    assert.ok(second.observations.every((item) => item.observationType === "cart.abandoned_value"));
    assert.equal((await request("/api/observations?cursor=malformed", { headers: headersA })).status, 400);
    const wrongKind = encodeCursor("feature_values", { calculatedAt: first.observations[0].calculatedAt, id: first.observations[0].id });
    assert.equal((await request(`/api/observations?cursor=${encodeURIComponent(wrongKind)}`, { headers: headersA })).status, 400);
    const cross = await (await request(`/api/observations?limit=1&cursor=${encodeURIComponent(first.nextCursor)}`, { headers: headersB })).json();
    assert.deepEqual(cross.observations, []);
  });

  await t.test("event cursor pagination is stable, bounded, tenant-safe, and observable", async () => {
    const complete = await (await request("/api/events?limit=100", { headers: headersA })).json();
    const first = await (await request("/api/events?limit=2", { headers: headersA })).json();
    assert.equal(first.events.length, 2); assert.ok(first.nextCursor);
    const second = await (await request(`/api/events?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`, { headers: headersA })).json();
    assert.equal(new Set([...first.events,...second.events].map(x=>x.id)).size, first.events.length+second.events.length);
    assert.deepEqual([...first.events,...second.events].map(x=>x.id), complete.events.slice(0,4).map(x=>x.id));
    assert.equal((await request("/api/events?cursor=not-a-valid-cursor", { headers: headersA })).status, 400);
    const cross = await (await request(`/api/events?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`, { headers: headersB })).json();
    assert.equal(cross.events.length, 0);
    const measurement=operationMetrics.recent().at(-2);assert.equal(measurement.operation,"business_events.list");assert.equal(measurement.rowsWritten,0);assert.ok(measurement.durationMs>=0);
  });

  await t.test("signal producers obey the Business Context architecture boundary", () => {
    const output = execFileSync(process.execPath, [join(import.meta.dirname, "../scripts/check-db-boundaries.mjs")], { encoding: "utf8" });
    assert.match(output, /Business Context consumer boundary is valid/);
  });

  await t.test("SQLite integrity and foreign keys remain valid", () => {
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });

  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
