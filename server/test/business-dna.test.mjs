import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createBusinessDnaRepository } from "../app/repositories/business-dna-repository.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBusinessDnaRouter } from "../app/routes/business-dna.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createBusinessDnaService } from "../app/services/business-dna-service.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";
import { migration005BusinessProfiles } from "../db/migrations/005_business_profiles.mjs";
import { migration006BusinessDnaVersions } from "../db/migrations/006_business_dna_versions.mjs";
import { migration007BusinessDnaImmutability } from "../db/migrations/007_business_dna_immutability.mjs";

test("Phase 2B Business DNA persistence and versioning", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-business-dna-"));
  const db = new Database(join(directory, "business-dna.sqlite"));
  db.pragma("foreign_keys = ON");
  const migrationList = [
    migration001Identity,
    migration004WorkspaceManagementAudit,
    migration005BusinessProfiles,
    migration006BusinessDnaVersions,
    migration007BusinessDnaImmutability,
  ];
  runMigrations(db, migrationList);
  runMigrations(db, migrationList);

  const identityRepository = createIdentityRepository(db);
  const authService = createAuthService({ repository: identityRepository, otpHashSecret: "dna-test-secret" });
  const profileService = createBusinessProfileService({
    repository: createBusinessProfileRepository(db),
    auditRepository: identityRepository,
  });
  const dnaService = createBusinessDnaService({
    repository: createBusinessDnaRepository(db),
    auditRepository: identityRepository,
  });

  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter({ authService, nodeEnv: "test", exposeDevelopmentOtp: true }));
  app.use(createRequireAuth(authService));
  app.use("/api/workspaces", createWorkspaceRouter({ authService }));
  app.use(createRequireWorkspace(identityRepository));
  app.use((req, res, next) => runWithWorkspace(req.workspace.id, next));
  app.use("/api/business-profile", createBusinessProfileRouter({ businessProfileService: profileService }));
  app.use("/api/business-dna", createBusinessDnaRouter({ businessDnaService: dnaService }));

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

  const userA = await register("09126660001", "DNA User A");
  const userB = await register("09126660002", "DNA User B");
  const jsonA = { Cookie: userA.cookie, "Content-Type": "application/json" };
  const jsonB = { Cookie: userB.cookie, "Content-Type": "application/json" };

  await t.test("migration is idempotent", () => {
    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    assert.deepEqual(versions.map(({ version }) => version), [1, 4, 5, 6, 7]);
  });

  await t.test("unauthenticated access is rejected", async () => {
    assert.equal((await request("/api/business-dna")).status, 401);
  });

  await t.test("Business Profile is required", async () => {
    const response = await request("/api/business-dna/versions", {
      method: "POST", headers: jsonB, body: JSON.stringify({ valueProposition: "No profile" }),
    });
    assert.equal(response.status, 409);
  });

  await request("/api/business-profile", {
    method: "POST", headers: jsonA, body: JSON.stringify({ name: "DNA Business A" }),
  });
  await request("/api/business-profile", {
    method: "POST", headers: jsonB, body: JSON.stringify({ name: "DNA Business B" }),
  });

  let versionOne;
  await t.test("workspace A creates and updates draft version 1", async () => {
    const created = await request("/api/business-dna/versions", {
      method: "POST",
      headers: jsonA,
      body: JSON.stringify({
        valueProposition: "Original value proposition",
        targetAudiences: ["Small businesses"],
        offerings: ["Automation"],
      }),
    });
    assert.equal(created.status, 201);
    versionOne = (await created.json()).version;
    assert.equal(versionOne.versionNumber, 1);
    assert.equal(versionOne.status, "draft");

    const updated = await request(`/api/business-dna/versions/${versionOne.id}`, {
      method: "PATCH", headers: jsonA, body: JSON.stringify({ positioning: "Growth platform" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).version.positioning, "Growth platform");
  });

  await t.test("workspace B cannot read or mutate workspace A versions", async () => {
    const current = await request("/api/business-dna", { headers: jsonB });
    const body = await current.json();
    assert.equal(body.activeVersion, null);
    assert.equal(body.latestDraft, null);
    const update = await request(`/api/business-dna/versions/${versionOne.id}`, {
      method: "PATCH", headers: jsonB, body: JSON.stringify({ positioning: "Hijacked" }),
    });
    assert.equal(update.status, 404);
    const forbiddenWorkspace = await request("/api/business-dna/versions", {
      method: "POST", headers: jsonB,
      body: JSON.stringify({ workspaceId: userA.data.activeWorkspace.id, valueProposition: "Hijacked" }),
    });
    assert.equal(forbiddenWorkspace.status, 400);
  });

  await t.test("activation makes active versions immutable", async () => {
    const activated = await request(`/api/business-dna/versions/${versionOne.id}/activate`, {
      method: "POST", headers: jsonA,
    });
    assert.equal(activated.status, 200);
    assert.equal((await activated.json()).version.status, "active");
    const update = await request(`/api/business-dna/versions/${versionOne.id}`, {
      method: "PATCH", headers: jsonA, body: JSON.stringify({ positioning: "Changed" }),
    });
    assert.equal(update.status, 409);
    assert.throws(() => db.prepare(
      "UPDATE business_dna_versions SET positioning = 'Direct mutation' WHERE id = ?"
    ).run(versionOne.id));
  });

  let versionTwo;
  await t.test("activating version 2 archives version 1 and keeps one active", async () => {
    const created = await request("/api/business-dna/versions", {
      method: "POST", headers: jsonA,
      body: JSON.stringify({ valueProposition: "Second version", goals: ["Grow"] }),
    });
    versionTwo = (await created.json()).version;
    assert.equal(versionTwo.versionNumber, 2);
    const activated = await request(`/api/business-dna/versions/${versionTwo.id}/activate`, {
      method: "POST", headers: jsonA,
    });
    assert.equal(activated.status, 200);
    assert.equal(
      db.prepare("SELECT status FROM business_dna_versions WHERE id = ?").get(versionOne.id).status,
      "archived"
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM business_dna_versions WHERE workspace_id = ? AND status = 'active'")
        .get(userA.data.activeWorkspace.id).count,
      1
    );
    assert.throws(() => db.prepare("UPDATE business_dna_versions SET status = 'active' WHERE id = ?").run(versionOne.id));
  });

  await t.test("drafts can be archived but active versions cannot", async () => {
    const created = await request("/api/business-dna/versions", {
      method: "POST", headers: jsonA, body: JSON.stringify({ constraints: ["Budget"] }),
    });
    const versionThree = (await created.json()).version;
    const archived = await request(`/api/business-dna/versions/${versionThree.id}/archive`, {
      method: "POST", headers: jsonA,
    });
    assert.equal(archived.status, 200);
    assert.equal((await archived.json()).version.status, "archived");
    const archivedUpdate = await request(`/api/business-dna/versions/${versionThree.id}`, {
      method: "PATCH", headers: jsonA, body: JSON.stringify({ positioning: "Changed" }),
    });
    assert.equal(archivedUpdate.status, 409);
    const archiveActive = await request(`/api/business-dna/versions/${versionTwo.id}/archive`, {
      method: "POST", headers: jsonA,
    });
    assert.equal(archiveActive.status, 409);
  });

  await t.test("workspace switching resolves independent DNA", async () => {
    const workspaceC = "workspace-dna-c";
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .run(workspaceC, "DNA C", "dna-c", "active", timestamp, timestamp);
    db.prepare(`INSERT INTO workspace_memberships
      (id,workspace_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(crypto.randomUUID(), workspaceC, userA.data.user.id, "admin", "active", timestamp, timestamp);
    await request("/api/workspaces/active", {
      method: "POST", headers: jsonA, body: JSON.stringify({ workspaceId: workspaceC }),
    });
    await request("/api/business-profile", {
      method: "POST", headers: jsonA, body: JSON.stringify({ name: "DNA Business C" }),
    });
    const created = await request("/api/business-dna/versions", {
      method: "POST", headers: jsonA, body: JSON.stringify({ valueProposition: "Workspace C DNA" }),
    });
    const cVersion = (await created.json()).version;
    await request(`/api/business-dna/versions/${cVersion.id}/activate`, { method: "POST", headers: jsonA });
    await request("/api/workspaces/active", {
      method: "POST", headers: jsonA, body: JSON.stringify({ workspaceId: userA.data.activeWorkspace.id }),
    });
    const current = await request("/api/business-dna", { headers: jsonA });
    assert.equal((await current.json()).activeVersion.id, versionTwo.id);
  });

  await t.test("cross-workspace profile references are rejected by SQLite", () => {
    const profileB = db.prepare("SELECT id FROM business_profiles WHERE workspace_id = ?")
      .get(userB.data.activeWorkspace.id);
    const timestamp = new Date().toISOString();
    assert.throws(() => db.prepare(`INSERT INTO business_dna_versions
      (id,workspace_id,business_profile_id,version_number,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run(
        crypto.randomUUID(), userA.data.activeWorkspace.id, profileB.id, 99, "draft", timestamp, timestamp
      ));
  });

  await t.test("version lifecycle audit logs contain metadata, not DNA content", () => {
    const rows = db.prepare(`SELECT action, metadata_json FROM audit_logs
      WHERE workspace_id = ? AND resource_type = 'business_dna_version' ORDER BY created_at`)
      .all(userA.data.activeWorkspace.id);
    const actions = rows.map(({ action }) => action);
    assert.ok(actions.includes("business_dna.version_created"));
    assert.ok(actions.includes("business_dna.draft_updated"));
    assert.ok(actions.includes("business_dna.version_activated"));
    assert.ok(actions.includes("business_dna.version_archived"));
    assert.ok(!JSON.stringify(rows).includes("Original value proposition"));
    assert.ok(!JSON.stringify(rows).includes("Growth platform"));
  });

  await t.test("database remains valid", () => {
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });

  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
