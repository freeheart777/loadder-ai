import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createBrandBookRepository } from "../app/repositories/brand-book-repository.mjs";
import { createBusinessContextRepository } from "../app/repositories/business-context-repository.mjs";
import { createBusinessContextUsageRepository } from "../app/repositories/business-context-usage-repository.mjs";
import { createBusinessDnaRepository } from "../app/repositories/business-dna-repository.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBrandBookRouter } from "../app/routes/brand-book.mjs";
import { createBusinessContextRouter } from "../app/routes/business-context.mjs";
import { createBusinessDnaRouter } from "../app/routes/business-dna.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createTextAiContextRouter } from "../app/routes/text-ai-context.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createBrandBookService } from "../app/services/brand-book-service.mjs";
import { createBusinessContextService } from "../app/services/business-context-service.mjs";
import { createBusinessDnaService } from "../app/services/business-dna-service.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
import { createBusinessContextConsumerGateway } from "../app/context-consumers/business-context-consumer-gateway.mjs";
import { contextCapabilityRegistry, createContextCapabilityRegistry } from "../app/context-consumers/capability-registry.mjs";
import { createTextAiContextConsumer } from "../app/context-consumers/text-ai-consumer.mjs";
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

test("Phase 3A Business Context Consumer Gateway", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-consumer-gateway-"));
  const db = new Database(join(directory, "gateway.sqlite"));
  db.pragma("foreign_keys = ON");
  const migrationList = [
    migration001Identity, migration004WorkspaceManagementAudit, migration005BusinessProfiles,
    migration006BusinessDnaVersions, migration007BusinessDnaImmutability,
    migration008BrandBookVersions, migration009BrandBookImmutability,
    migration010BusinessContextVersions, migration011BusinessContextImmutability,
    migration012BusinessContextLifecycleGuards, migration013BusinessContextUsage,
  ];
  runMigrations(db, migrationList);
  runMigrations(db, migrationList);

  let nowMs = Date.parse("2026-08-21T12:00:00.000Z");
  const now = () => new Date((nowMs += 1000));
  const identities = createIdentityRepository(db);
  const authService = createAuthService({ repository: identities, otpHashSecret: "gateway-test-secret" });
  const profileService = createBusinessProfileService({ repository: createBusinessProfileRepository(db), auditRepository: identities, now });
  const dnaService = createBusinessDnaService({ repository: createBusinessDnaRepository(db), auditRepository: identities, now });
  const brandService = createBrandBookService({ repository: createBrandBookRepository(db), auditRepository: identities, now });
  const contextService = createBusinessContextService({ repository: createBusinessContextRepository(db), auditRepository: identities, now });
  const usageRepository = createBusinessContextUsageRepository(db);
  const gateway = createBusinessContextConsumerGateway({
    businessContextService: contextService, usageRepository,
    capabilityRegistry: contextCapabilityRegistry, now,
  });
  const textAi = createTextAiContextConsumer({ contextGateway: gateway });

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
  app.use("/api/text-ai/context", createTextAiContextRouter({ textAiContextConsumer: textAi }));

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
  const userA = await register("09123330001", "Gateway A");
  const userB = await register("09123330002", "Gateway B");
  const headersA = { Cookie: userA.cookie, "Content-Type": "application/json" };
  const headersB = { Cookie: userB.cookie, "Content-Type": "application/json" };
  const post = (path, headers, body = {}) => request(path, { method: "POST", headers, body: JSON.stringify(body) });

  async function establishActiveContext(headers, name) {
    await post("/api/business-profile", headers, { name, industry: "Software", city: "Tehran" });
    let response = await post("/api/business-dna/versions", headers, {
      valueProposition: "One shared truth", targetAudiences: ["SMBs"], offerings: ["Platform"], goals: ["Grow"],
    });
    const dna = (await response.json()).version;
    await post(`/api/business-dna/versions/${dna.id}/activate`, headers);
    response = await post("/api/brand-book/versions", headers, {
      brandPersonality: ["Clear"], toneOfVoice: "Direct", primaryColors: ["#7C3AED"],
    });
    const brand = (await response.json()).version;
    await post(`/api/brand-book/versions/${brand.id}/activate`, headers);
    const draft = (await (await post("/api/business-context/versions", headers)).json()).version;
    return (await (await post(`/api/business-context/versions/${draft.id}/activate`, headers)).json()).version;
  }

  await t.test("migration is idempotent and pilot requires authentication", async () => {
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version=13").get().count, 1);
    assert.equal((await post("/api/text-ai/context/prepare", { "Content-Type": "application/json" })).status, 401);
  });

  await t.test("missing context is explicit and records no usage", async () => {
    const response = await post("/api/text-ai/context/prepare", headersA, { executionRequestId: "missing-1" });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).state, "MISSING_CONTEXT");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM business_context_usage").get().count, 0);
  });

  let contextA;
  await t.test("READY returns the pinned contract and attributes Text AI usage", async () => {
    contextA = await establishActiveContext(headersA, "Gateway Business A");
    const response = await post("/api/text-ai/context/prepare", headersA, { executionRequestId: "request-123" });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.state, "READY");
    assert.equal(data.contextVersionId, contextA.id);
    assert.equal(data.contextSchemaVersion, "1.0");
    assert.equal(data.sourceVersionReferences.businessDna.id, contextA.businessDnaVersionId);
    assert.equal(data.normalizedInput.identity.businessName, "Gateway Business A");
    assert.equal(Object.hasOwn(data, "answer"), false);
    const usage = db.prepare("SELECT * FROM business_context_usage WHERE id=?").get(data.usageId);
    assert.equal(usage.workspace_id, userA.data.activeWorkspace.id);
    assert.equal(usage.context_version_id, contextA.id);
    assert.equal(usage.consumer, "text_ai");
    assert.equal(usage.operation, "prepare_context");
    assert.equal(usage.execution_request_id, "request-123");
    assert.ok(!JSON.stringify(usage).includes("One shared truth"));
  });

  await t.test("stale context is rejected without new attribution", async () => {
    const before = db.prepare("SELECT COUNT(*) AS count FROM business_context_usage").get().count;
    await request("/api/business-profile", {
      method: "PATCH", headers: headersA, body: JSON.stringify({ city: "Shiraz" }),
    });
    const response = await post("/api/text-ai/context/prepare", headersA);
    const data = await response.json();
    assert.equal(response.status, 409);
    assert.equal(data.state, "STALE_CONTEXT");
    assert.deepEqual(data.staleReasons, ["BUSINESS_PROFILE_CHANGED"]);
    assert.equal(data.contextVersionId, contextA.id);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM business_context_usage").get().count, before);
  });

  await t.test("schema and capability compatibility are explicit", () => {
    assert.throws(() => createContextCapabilityRegistry([{
      consumer: "invalid", supportedContextSchemaVersions: [],
      requiredContextSections: [], optionalContextSections: [],
    }]));
    const unsupportedRegistry = createContextCapabilityRegistry([{
      consumer: "future_consumer", supportedContextSchemaVersions: ["2.0"],
      requiredContextSections: ["identity"], optionalContextSections: [],
    }]);
    const unsupportedGateway = createBusinessContextConsumerGateway({
      businessContextService: {
        getCurrent: () => ({ activeContext: contextA, isStale: false, staleReasons: [] }),
      },
      usageRepository, capabilityRegistry: unsupportedRegistry, now,
    });
    const result = runWithWorkspace(userA.data.activeWorkspace.id, () => unsupportedGateway.consume({
      consumer: "future_consumer", operation: "validate", userId: userA.data.user.id,
    }));
    assert.equal(result.state, "UNSUPPORTED_SCHEMA");
    assert.deepEqual(result.supportedContextSchemaVersions, ["2.0"]);
  });

  await t.test("tenants and workspace switches resolve independent gateway state", async () => {
    let response = await post("/api/text-ai/context/prepare", headersB);
    assert.equal((await response.json()).state, "MISSING_CONTEXT");
    const secondWorkspaceId = "gateway-second-workspace";
    const timestamp = now().toISOString();
    db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .run(secondWorkspaceId, "Gateway Second", "gateway-second", "active", timestamp, timestamp);
    db.prepare(`INSERT INTO workspace_memberships
      (id,workspace_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(crypto.randomUUID(), secondWorkspaceId, userA.data.user.id, "admin", "active", timestamp, timestamp);
    await post("/api/workspaces/active", headersA, { workspaceId: secondWorkspaceId });
    response = await post("/api/text-ai/context/prepare", headersA);
    assert.equal((await response.json()).state, "MISSING_CONTEXT");
    await post("/api/workspaces/active", headersA, { workspaceId: userA.data.activeWorkspace.id });
    response = await post("/api/text-ai/context/prepare", headersA);
    assert.equal((await response.json()).state, "STALE_CONTEXT");
  });

  await t.test("database rejects cross-workspace attribution and usage is immutable", () => {
    const usage = db.prepare("SELECT * FROM business_context_usage LIMIT 1").get();
    assert.throws(() => db.prepare(`INSERT INTO business_context_usage
      (id,workspace_id,context_version_id,consumer,operation,created_at)
      VALUES (?,?,?,?,?,?)`).run(
        crypto.randomUUID(), userB.data.activeWorkspace.id, contextA.id,
        "text_ai", "cross_tenant", now().toISOString()
      ));
    assert.throws(() => db.prepare("UPDATE business_context_usage SET operation='changed' WHERE id=?").run(usage.id));
  });

  await t.test("consumer architecture guard prevents direct source access", () => {
    const output = execFileSync(process.execPath, [join(import.meta.dirname, "../scripts/check-db-boundaries.mjs")], {
      encoding: "utf8",
    });
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
