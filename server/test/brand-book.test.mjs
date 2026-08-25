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
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBrandBookRouter } from "../app/routes/brand-book.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createDevelopmentOtpDelivery } from "../app/auth/sms-ir-otp-delivery.mjs";
import { createBrandBookService } from "../app/services/brand-book-service.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";
import { migration005BusinessProfiles } from "../db/migrations/005_business_profiles.mjs";
import { migration008BrandBookVersions } from "../db/migrations/008_brand_book_versions.mjs";
import { migration009BrandBookImmutability } from "../db/migrations/009_brand_book_immutability.mjs";

test("Phase 2C Brand Book persistence and versioning", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-brand-book-"));
  const db = new Database(join(directory, "brand-book.sqlite"));
  db.pragma("foreign_keys = ON");
  const migrationList = [
    migration001Identity, migration004WorkspaceManagementAudit,
    migration005BusinessProfiles, migration008BrandBookVersions,
    migration009BrandBookImmutability,
  ];
  runMigrations(db, migrationList);
  runMigrations(db, migrationList);

  const identityRepository = createIdentityRepository(db);
  const authService = createAuthService({ repository: identityRepository, otpHashSecret: "brand-book-test-secret", otpDelivery: createDevelopmentOtpDelivery() });
  const profileService = createBusinessProfileService({
    repository: createBusinessProfileRepository(db), auditRepository: identityRepository,
  });
  const brandBookService = createBrandBookService({
    repository: createBrandBookRepository(db), auditRepository: identityRepository,
  });
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter({ authService, nodeEnv: "test", exposeDevelopmentOtp: true }));
  app.use(createRequireAuth(authService));
  app.use("/api/workspaces", createWorkspaceRouter({ authService }));
  app.use(createRequireWorkspace(identityRepository));
  app.use((req, res, next) => runWithWorkspace(req.workspace.id, next));
  app.use("/api/business-profile", createBusinessProfileRouter({ businessProfileService: profileService }));
  app.use("/api/brand-book", createBrandBookRouter({ brandBookService }));

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
  const userA = await register("09128880001", "Brand User A");
  const userB = await register("09128880002", "Brand User B");
  const headersA = { Cookie: userA.cookie, "Content-Type": "application/json" };
  const headersB = { Cookie: userB.cookie, "Content-Type": "application/json" };

  await t.test("migration is idempotent", () => {
    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    assert.deepEqual(versions.map(({ version }) => version), [1, 4, 5, 8, 9]);
  });
  await t.test("authentication and Business Profile are required", async () => {
    assert.equal((await request("/api/brand-book")).status, 401);
    const response = await request("/api/brand-book/versions", {
      method: "POST", headers: headersB, body: JSON.stringify({ toneOfVoice: "Friendly" }),
    });
    assert.equal(response.status, 409);
  });
  await request("/api/business-profile", {
    method: "POST", headers: headersA, body: JSON.stringify({ name: "Brand A" }),
  });
  await request("/api/business-profile", {
    method: "POST", headers: headersB, body: JSON.stringify({ name: "Brand B" }),
  });

  let versionOne;
  await t.test("workspace A creates and updates a structured draft", async () => {
    const created = await request("/api/brand-book/versions", {
      method: "POST", headers: headersA, body: JSON.stringify({
        brandIdentity: { name: "Loadder", industry: "Technology" },
        brandPersonality: ["Bold", "Helpful"], toneOfVoice: "Professional",
        messagingPrinciples: ["Be clear"], visualDirection: "Minimal",
        primaryColors: ["#7C3AED"], secondaryColors: ["#06B6D4"],
        typography: { primary: "Geist" }, logoUsageNotes: "Keep clear space",
        imageryDirection: "Modern", prohibitedPatterns: ["Fear language"],
        keyPhrases: ["Grow intelligently"], brandPromises: ["Clarity"],
      }),
    });
    assert.equal(created.status, 201);
    versionOne = (await created.json()).version;
    assert.equal(versionOne.versionNumber, 1);
    assert.deepEqual(versionOne.brandPersonality, ["Bold", "Helpful"]);
    const updated = await request(`/api/brand-book/versions/${versionOne.id}`, {
      method: "PATCH", headers: headersA, body: JSON.stringify({ toneOfVoice: "Professional and warm" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).version.toneOfVoice, "Professional and warm");
  });

  await t.test("tenant isolation rejects cross-workspace access and payload ownership", async () => {
    const currentB = await request("/api/brand-book", { headers: headersB });
    assert.equal((await currentB.json()).latestDraft, null);
    const update = await request(`/api/brand-book/versions/${versionOne.id}`, {
      method: "PATCH", headers: headersB, body: JSON.stringify({ toneOfVoice: "Hijacked" }),
    });
    assert.equal(update.status, 404);
    const suppliedWorkspace = await request("/api/brand-book/versions", {
      method: "POST", headers: headersB,
      body: JSON.stringify({ workspace_id: userA.data.activeWorkspace.id, toneOfVoice: "Hijacked" }),
    });
    assert.equal(suppliedWorkspace.status, 400);
  });

  await t.test("activation makes version 1 immutable at API and database levels", async () => {
    const activated = await request(`/api/brand-book/versions/${versionOne.id}/activate`, {
      method: "POST", headers: headersA,
    });
    assert.equal(activated.status, 200);
    const update = await request(`/api/brand-book/versions/${versionOne.id}`, {
      method: "PATCH", headers: headersA, body: JSON.stringify({ toneOfVoice: "Changed" }),
    });
    assert.equal(update.status, 409);
    assert.throws(() => db.prepare("UPDATE brand_book_versions SET tone_of_voice = ? WHERE id = ?")
      .run("Direct mutation", versionOne.id));
  });

  let versionTwo;
  await t.test("activating version 2 archives version 1 and enforces one active", async () => {
    const created = await request("/api/brand-book/versions", {
      method: "POST", headers: headersA,
      body: JSON.stringify({ brandIdentity: { name: "Loadder V2" }, brandPromises: ["Trust"] }),
    });
    versionTwo = (await created.json()).version;
    assert.equal(versionTwo.versionNumber, 2);
    assert.equal((await request(`/api/brand-book/versions/${versionTwo.id}/activate`, {
      method: "POST", headers: headersA,
    })).status, 200);
    assert.equal(db.prepare("SELECT status FROM brand_book_versions WHERE id = ?").get(versionOne.id).status, "archived");
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM brand_book_versions
      WHERE workspace_id = ? AND status = 'active'`).get(userA.data.activeWorkspace.id).count, 1);
    assert.throws(() => db.prepare("UPDATE brand_book_versions SET status = 'active' WHERE id = ?").run(versionOne.id));
  });

  await t.test("draft archival works and archived versions remain immutable", async () => {
    const created = await request("/api/brand-book/versions", {
      method: "POST", headers: headersA, body: JSON.stringify({ keyPhrases: ["Draft phrase"] }),
    });
    const versionThree = (await created.json()).version;
    const archived = await request(`/api/brand-book/versions/${versionThree.id}/archive`, {
      method: "POST", headers: headersA,
    });
    assert.equal((await archived.json()).version.status, "archived");
    assert.equal((await request(`/api/brand-book/versions/${versionThree.id}`, {
      method: "PATCH", headers: headersA, body: JSON.stringify({ toneOfVoice: "Changed" }),
    })).status, 409);
    assert.equal((await request(`/api/brand-book/versions/${versionTwo.id}/archive`, {
      method: "POST", headers: headersA,
    })).status, 409);
  });

  await t.test("workspace switching resolves independent Brand Books", async () => {
    const workspaceC = "workspace-brand-c";
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .run(workspaceC, "Brand C", "brand-c", "active", timestamp, timestamp);
    db.prepare(`INSERT INTO workspace_memberships
      (id,workspace_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(crypto.randomUUID(), workspaceC, userA.data.user.id, "admin", "active", timestamp, timestamp);
    await request("/api/workspaces/active", {
      method: "POST", headers: headersA, body: JSON.stringify({ workspaceId: workspaceC }),
    });
    await request("/api/business-profile", {
      method: "POST", headers: headersA, body: JSON.stringify({ name: "Brand C" }),
    });
    const created = await request("/api/brand-book/versions", {
      method: "POST", headers: headersA, body: JSON.stringify({ toneOfVoice: "Workspace C" }),
    });
    const cVersion = (await created.json()).version;
    await request(`/api/brand-book/versions/${cVersion.id}/activate`, { method: "POST", headers: headersA });
    await request("/api/workspaces/active", {
      method: "POST", headers: headersA, body: JSON.stringify({ workspaceId: userA.data.activeWorkspace.id }),
    });
    const currentA = await request("/api/brand-book", { headers: headersA });
    assert.equal((await currentA.json()).activeVersion.id, versionTwo.id);
  });

  await t.test("cross-workspace Business Profile references are rejected", () => {
    const profileB = db.prepare("SELECT id FROM business_profiles WHERE workspace_id = ?")
      .get(userB.data.activeWorkspace.id);
    const timestamp = new Date().toISOString();
    assert.throws(() => db.prepare(`INSERT INTO brand_book_versions
      (id,workspace_id,business_profile_id,version_number,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run(
        crypto.randomUUID(), userA.data.activeWorkspace.id, profileB.id, 99, "draft", timestamp, timestamp
      ));
  });

  await t.test("audit logging records lifecycle without Brand Book content", () => {
    const rows = db.prepare(`SELECT action, metadata_json FROM audit_logs
      WHERE workspace_id = ? AND resource_type = 'brand_book_version' ORDER BY created_at`)
      .all(userA.data.activeWorkspace.id);
    const actions = rows.map(({ action }) => action);
    for (const action of [
      "brand_book.version_created", "brand_book.draft_updated",
      "brand_book.version_activated", "brand_book.version_archived",
    ]) assert.ok(actions.includes(action));
    const serialized = JSON.stringify(rows);
    assert.ok(!serialized.includes("Professional and warm"));
    assert.ok(!serialized.includes("Grow intelligently"));
  });

  await t.test("version history, SQLite integrity, and foreign keys are valid", async () => {
    const history = await request("/api/brand-book/versions", { headers: headersA });
    assert.equal((await history.json()).versions.length, 3);
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });

  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
