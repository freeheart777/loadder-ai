import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createBrandBookRepository } from "../app/repositories/brand-book-repository.mjs";
import { createBusinessContextRepository } from "../app/repositories/business-context-repository.mjs";
import { createBusinessDnaRepository } from "../app/repositories/business-dna-repository.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBrandBookRouter } from "../app/routes/brand-book.mjs";
import { createBusinessContextRouter } from "../app/routes/business-context.mjs";
import { createBusinessDnaRouter } from "../app/routes/business-dna.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createDevelopmentOtpDelivery } from "../app/auth/sms-ir-otp-delivery.mjs";
import { createBrandBookService } from "../app/services/brand-book-service.mjs";
import { createBusinessContextService } from "../app/services/business-context-service.mjs";
import { createBusinessDnaService } from "../app/services/business-dna-service.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
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

test("Phase 2D versioned Business Context foundation", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-context-"));
  const db = new Database(join(directory, "context.sqlite"));
  db.pragma("foreign_keys = ON");
  const migrationList = [
    migration001Identity, migration004WorkspaceManagementAudit,
    migration005BusinessProfiles, migration006BusinessDnaVersions,
    migration007BusinessDnaImmutability, migration008BrandBookVersions,
    migration009BrandBookImmutability, migration010BusinessContextVersions,
    migration011BusinessContextImmutability, migration012BusinessContextLifecycleGuards,
  ];
  runMigrations(db, migrationList);
  runMigrations(db, migrationList);

  let nowMs = Date.parse("2026-08-21T09:00:00.000Z");
  const now = () => new Date((nowMs += 1000));
  const identities = createIdentityRepository(db);
  const authService = createAuthService({ repository: identities, otpHashSecret: "context-test-secret", otpDelivery: createDevelopmentOtpDelivery() });
  const profileService = createBusinessProfileService({ repository: createBusinessProfileRepository(db), auditRepository: identities, now });
  const dnaService = createBusinessDnaService({ repository: createBusinessDnaRepository(db), auditRepository: identities, now });
  const brandService = createBrandBookService({ repository: createBrandBookRepository(db), auditRepository: identities, now });
  const contextService = createBusinessContextService({ repository: createBusinessContextRepository(db), auditRepository: identities, now });

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

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const { port } = server.address();
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${port}${path}`, options);
  async function register(mobile, name) {
    const sent = await request("/api/auth/send-otp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, name }),
    });
    const otp = await sent.json();
    const verified = await request("/api/auth/verify-otp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, code: otp.developmentOtp }),
    });
    return { data: await verified.json(), cookie: verified.headers.get("set-cookie").split(";")[0] };
  }
  const userA = await register("09121110001", "Context A");
  const userB = await register("09121110002", "Context B");
  const headersA = { Cookie: userA.cookie, "Content-Type": "application/json" };
  const headersB = { Cookie: userB.cookie, "Content-Type": "application/json" };
  const post = (path, headers, body = {}) => request(path, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  async function createAndActivateDna(headers, payload) {
    const created = await post("/api/business-dna/versions", headers, payload);
    const version = (await created.json()).version;
    await post(`/api/business-dna/versions/${version.id}/activate`, headers);
    return version;
  }
  async function createAndActivateBrand(headers, payload) {
    const created = await post("/api/brand-book/versions", headers, payload);
    const version = (await created.json()).version;
    await post(`/api/brand-book/versions/${version.id}/activate`, headers);
    return version;
  }

  await t.test("migration is idempotent and authentication is required", async () => {
    assert.deepEqual(
      db.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map(({ version }) => version),
      [1, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    );
    assert.equal((await request("/api/business-context")).status, 401);
  });

  await t.test("Profile, active DNA, and active Brand Book are required in order", async () => {
    assert.equal((await post("/api/business-context/versions", headersA)).status, 409);
    await post("/api/business-profile", headersA, {
      name: "Context Business", industry: "Technology", country: "Iran", city: "Tehran",
    });
    let response = await post("/api/business-context/versions", headersA);
    assert.equal((await response.json()).code, "ACTIVE_BUSINESS_DNA_REQUIRED");
    await createAndActivateDna(headersA, {
      valueProposition: "Unified growth platform", positioning: "AI operating layer",
      targetAudiences: ["SMBs"], offerings: ["CRM"], differentiators: ["Unified"],
      goals: ["Grow"], constraints: ["Budget"], growthDrivers: ["Automation"], brandVoice: "Clear",
    });
    response = await post("/api/business-context/versions", headersA);
    assert.equal((await response.json()).code, "ACTIVE_BRAND_BOOK_REQUIRED");
    await createAndActivateBrand(headersA, {
      brandIdentity: { audienceProblem: "Fragmented tools" }, brandPersonality: ["Bold"],
      toneOfVoice: "Professional", messagingPrinciples: ["Be clear"],
      visualDirection: "Minimal", primaryColors: ["#7C3AED"], secondaryColors: ["#06B6D4"],
      typography: { primary: "Geist" }, logoUsageNotes: "Clear space",
      imageryDirection: "Modern", prohibitedPatterns: ["Fear"],
      keyPhrases: ["Grow intelligently"], brandPromises: ["Clarity"],
    });
    const profileB = await post("/api/business-profile", headersB, { name: "Context Business B" });
    assert.equal(profileB.status, 201);
  });

  let firstDraft;
  let activeOne;
  let historicalSnapshot;
  await t.test("deterministic drafts pin exact sources and reject submitted snapshots", async () => {
    const forbidden = await post("/api/business-context/versions", headersA, { snapshot: { injected: true } });
    assert.equal(forbidden.status, 400);
    const first = await post("/api/business-context/versions", headersA);
    const second = await post("/api/business-context/versions", headersA);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    firstDraft = (await first.json()).version;
    const secondDraft = (await second.json()).version;
    assert.deepEqual(firstDraft.snapshot, secondDraft.snapshot);
    assert.deepEqual(firstDraft.sourceManifest, secondDraft.sourceManifest);
    assert.equal(firstDraft.snapshot.identity.businessName, "Context Business");
    assert.deepEqual(firstDraft.snapshot.strategy.goals, ["Grow"]);
    assert.deepEqual(firstDraft.snapshot.audiences.audienceProblems, ["Fragmented tools"]);
    assert.equal(firstDraft.snapshot.metadata.contextSchemaVersion, "1.0");
    assert.equal(firstDraft.businessDnaVersionId, firstDraft.sourceManifest.businessDna.id);
    assert.equal(firstDraft.brandBookVersionId, firstDraft.sourceManifest.brandBook.id);
    await post(`/api/business-context/versions/${firstDraft.id}/archive`, headersA);
    const activated = await post(`/api/business-context/versions/${secondDraft.id}/activate`, headersA);
    activeOne = (await activated.json()).version;
    historicalSnapshot = JSON.stringify(activeOne.snapshot);
  });

  await t.test("tenant isolation prevents reading or acting on another workspace context", async () => {
    const stateB = await request("/api/business-context", { headers: headersB });
    assert.equal((await stateB.json()).activeContext, null);
    assert.equal((await post(`/api/business-context/versions/${activeOne.id}/activate`, headersB)).status, 404);
  });

  await t.test("Business Profile changes mark context stale without mutating history", async () => {
    await request("/api/business-profile", {
      method: "PATCH", headers: headersA, body: JSON.stringify({ city: "Shiraz" }),
    });
    const state = await request("/api/business-context", { headers: headersA });
    const data = await state.json();
    assert.equal(data.isStale, true);
    assert.deepEqual(data.staleReasons, ["BUSINESS_PROFILE_CHANGED"]);
    assert.equal(JSON.stringify(data.activeContext.snapshot), historicalSnapshot);
    const rebuilt = (await (await post("/api/business-context/versions", headersA)).json()).version;
    const activated = await post(`/api/business-context/versions/${rebuilt.id}/activate`, headersA);
    assert.equal(activated.status, 200);
    assert.equal(db.prepare("SELECT status FROM business_context_versions WHERE id=?").get(activeOne.id).status, "archived");
    activeOne = (await activated.json()).version;
    historicalSnapshot = JSON.stringify(activeOne.snapshot);
  });

  await t.test("DNA changes stale active context and invalidate an older draft", async () => {
    const oldDraft = (await (await post("/api/business-context/versions", headersA)).json()).version;
    await createAndActivateDna(headersA, { valueProposition: "New DNA", goals: ["Scale"] });
    const state = await request("/api/business-context", { headers: headersA });
    const data = await state.json();
    assert.deepEqual(data.staleReasons, ["BUSINESS_DNA_CHANGED"]);
    assert.equal(JSON.stringify(data.activeContext.snapshot), historicalSnapshot);
    const staleActivation = await post(`/api/business-context/versions/${oldDraft.id}/activate`, headersA);
    assert.equal((await staleActivation.json()).code, "CONTEXT_DRAFT_STALE");
    const rebuilt = (await (await post("/api/business-context/versions", headersA)).json()).version;
    activeOne = (await (await post(`/api/business-context/versions/${rebuilt.id}/activate`, headersA)).json()).version;
    historicalSnapshot = JSON.stringify(activeOne.snapshot);
  });

  await t.test("Brand Book changes mark context stale and rebuilding creates a newer version", async () => {
    await createAndActivateBrand(headersA, { toneOfVoice: "Warm", brandPromises: ["Trust"] });
    const data = await (await request("/api/business-context", { headers: headersA })).json();
    assert.deepEqual(data.staleReasons, ["BRAND_BOOK_CHANGED"]);
    assert.equal(JSON.stringify(data.activeContext.snapshot), historicalSnapshot);
    const rebuilt = (await (await post("/api/business-context/versions", headersA)).json()).version;
    assert.ok(rebuilt.versionNumber > activeOne.versionNumber);
    await post(`/api/business-context/versions/${rebuilt.id}/activate`, headersA);
    const fresh = await (await request("/api/business-context", { headers: headersA })).json();
    assert.equal(fresh.isStale, false);
  });

  await t.test("active and archived snapshots are immutable and one active is enforced", () => {
    const active = db.prepare("SELECT * FROM business_context_versions WHERE workspace_id=? AND status='active'")
      .get(userA.data.activeWorkspace.id);
    const archived = db.prepare("SELECT * FROM business_context_versions WHERE workspace_id=? AND status='archived' LIMIT 1")
      .get(userA.data.activeWorkspace.id);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM business_context_versions WHERE workspace_id=? AND status='active'")
      .get(userA.data.activeWorkspace.id).count, 1);
    assert.throws(() => db.prepare("UPDATE business_context_versions SET snapshot_json='{}' WHERE id=?").run(active.id));
    assert.throws(() => db.prepare("UPDATE business_context_versions SET source_manifest_json='{}' WHERE id=?").run(archived.id));
    assert.throws(() => db.prepare("UPDATE business_context_versions SET status='active' WHERE id=?").run(archived.id));
    assert.throws(() => db.prepare("UPDATE business_context_versions SET status='draft' WHERE id=?").run(archived.id));
    assert.throws(() => db.prepare("DELETE FROM business_context_versions WHERE id=?").run(archived.id));
  });

  await t.test("workspace switching returns an independent context", async () => {
    const workspaceC = "workspace-context-c";
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .run(workspaceC, "Context C", "context-c", "active", timestamp, timestamp);
    db.prepare(`INSERT INTO workspace_memberships
      (id,workspace_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(crypto.randomUUID(), workspaceC, userA.data.user.id, "admin", "active", timestamp, timestamp);
    await post("/api/workspaces/active", headersA, { workspaceId: workspaceC });
    await post("/api/business-profile", headersA, { name: "Context C" });
    await createAndActivateDna(headersA, { valueProposition: "C DNA" });
    await createAndActivateBrand(headersA, { toneOfVoice: "C Tone" });
    const cDraft = (await (await post("/api/business-context/versions", headersA)).json()).version;
    await post(`/api/business-context/versions/${cDraft.id}/activate`, headersA);
    await post("/api/workspaces/active", headersA, { workspaceId: userA.data.activeWorkspace.id });
    const stateA = await (await request("/api/business-context", { headers: headersA })).json();
    assert.notEqual(stateA.activeContext.id, cDraft.id);
  });

  await t.test("database rejects cross-workspace source references", () => {
    const profileB = db.prepare("SELECT id FROM business_profiles WHERE workspace_id=?").get(userB.data.activeWorkspace.id);
    const sourcesA = db.prepare(`SELECT business_dna_version_id,brand_book_version_id
      FROM business_context_versions WHERE workspace_id=? LIMIT 1`).get(userA.data.activeWorkspace.id);
    assert.throws(() => db.prepare(`INSERT INTO business_context_versions
      (id,workspace_id,business_profile_id,business_dna_version_id,brand_book_version_id,
       version_number,status,context_schema_version,snapshot_json,source_manifest_json,created_at)
      VALUES (?,?,?,?,?,99,'draft','1.0','{}','{}',?)`).run(
        crypto.randomUUID(), userA.data.activeWorkspace.id, profileB.id,
        sourcesA.business_dna_version_id, sourcesA.brand_book_version_id, new Date().toISOString()
      ));
  });

  await t.test("audit metadata is minimized and database integrity holds", () => {
    const rows = db.prepare(`SELECT action,metadata_json FROM audit_logs
      WHERE workspace_id=? AND resource_type='business_context_version'`)
      .all(userA.data.activeWorkspace.id);
    for (const action of [
      "business_context.version_created", "business_context.version_activated",
      "business_context.version_archived",
    ]) assert.ok(rows.some((row) => row.action === action));
    const auditText = JSON.stringify(rows);
    assert.ok(!auditText.includes("Unified growth platform"));
    assert.ok(!auditText.includes("Grow intelligently"));
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });

  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
