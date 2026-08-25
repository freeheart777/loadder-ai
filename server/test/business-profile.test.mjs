import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createDevelopmentOtpDelivery } from "../app/auth/sms-ir-otp-delivery.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";
import { migration005BusinessProfiles } from "../db/migrations/005_business_profiles.mjs";

test("Phase 2A business profile foundation", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-business-profile-"));
  const db = new Database(join(directory, "business-profile.sqlite"));
  db.pragma("foreign_keys = ON");
  const migrationList = [
    migration001Identity,
    migration004WorkspaceManagementAudit,
    migration005BusinessProfiles,
  ];
  runMigrations(db, migrationList);
  runMigrations(db, migrationList);

  const repository = createIdentityRepository(db);
  const authService = createAuthService({
    repository,
    otpHashSecret: "business-profile-test-secret",
    otpDelivery: createDevelopmentOtpDelivery(),
  });
  const profileRepository = createBusinessProfileRepository(db);
  const businessProfileService = createBusinessProfileService({
    repository: profileRepository,
    auditRepository: repository,
  });

  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter({
    authService,
    nodeEnv: "test",
    exposeDevelopmentOtp: true,
  }));
  app.use(createRequireAuth(authService));
  app.use("/api/workspaces", createWorkspaceRouter({ authService }));
  app.use(createRequireWorkspace(repository));
  app.use((req, res, next) => runWithWorkspace(req.workspace.id, next));
  app.use("/api/business-profile", createBusinessProfileRouter({ businessProfileService }));

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const { port } = server.address();
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${port}${path}`, options);

  async function register(mobile, name) {
    const sent = await request("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, name }),
    });
    const challenge = await sent.json();
    const verified = await request("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, code: challenge.developmentOtp }),
    });
    return {
      data: await verified.json(),
      cookie: verified.headers.get("set-cookie").split(";")[0],
    };
  }

  const userA = await register("09124440001", "Business A Owner");
  const userB = await register("09124440002", "Business B Owner");
  const headersA = { Cookie: userA.cookie, "Content-Type": "application/json" };
  const headersB = { Cookie: userB.cookie, "Content-Type": "application/json" };

  await t.test("migration is idempotent", () => {
    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    assert.deepEqual(versions.map(({ version }) => version), [1, 4, 5]);
  });

  await t.test("unauthenticated access is rejected", async () => {
    assert.equal((await request("/api/business-profile")).status, 401);
  });

  await t.test("invalid URLs, emails, and statuses are rejected", async () => {
    for (const payload of [
      { name: "Invalid URL", website: "javascript:alert(1)" },
      { name: "Invalid Email", email: "not-an-email" },
      { name: "Invalid Status", status: "deleted" },
    ]) {
      const response = await request("/api/business-profile", {
        method: "POST",
        headers: headersA,
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 400);
    }
  });

  await t.test("workspace A creates its profile", async () => {
    const response = await request("/api/business-profile", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        name: "Acme A",
        website: "https://a.example.com",
        industry: "Technology",
        email: "hello@a.example.com",
      }),
    });
    assert.equal(response.status, 201);
    const { profile } = await response.json();
    assert.equal(profile.name, "Acme A");
    assert.equal(profile.website, "https://a.example.com/");
    assert.ok(!Object.hasOwn(profile, "workspaceId"));
  });

  await t.test("workspace B sees null and cannot target workspace A", async () => {
    const empty = await request("/api/business-profile", { headers: headersB });
    assert.equal((await empty.json()).profile, null);
    const response = await request("/api/business-profile", {
      method: "PATCH",
      headers: headersB,
      body: JSON.stringify({ workspaceId: userA.data.activeWorkspace.id, name: "Hijacked" }),
    });
    assert.equal(response.status, 400);
    assert.equal(
      db.prepare("SELECT name FROM business_profiles WHERE workspace_id = ?")
        .get(userA.data.activeWorkspace.id).name,
      "Acme A"
    );
  });

  await t.test("only one profile can exist per workspace", async () => {
    const response = await request("/api/business-profile", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ name: "Duplicate" }),
    });
    assert.equal(response.status, 409);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM business_profiles WHERE workspace_id = ?")
        .get(userA.data.activeWorkspace.id).count,
      1
    );
  });

  await t.test("profile update is scoped and audited", async () => {
    const response = await request("/api/business-profile", {
      method: "PATCH",
      headers: headersA,
      body: JSON.stringify({ name: "Acme A Updated", city: "Tehran" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profile.city, "Tehran");
    const audits = db.prepare(`
      SELECT action, metadata_json FROM audit_logs
      WHERE workspace_id = ? AND resource_type = 'business_profile'
      ORDER BY created_at
    `).all(userA.data.activeWorkspace.id);
    assert.deepEqual(audits.map(({ action }) => action), [
      "business_profile.created",
      "business_profile.updated",
    ]);
    assert.deepEqual(JSON.parse(audits[1].metadata_json).changedFields.sort(), ["city", "name"]);
    assert.ok(!audits[1].metadata_json.includes("Acme A Updated"));
  });

  await t.test("workspace switch resolves a different profile", async () => {
    const workspaceC = "workspace-business-c";
    const timestamp = new Date().toISOString();
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
      VALUES (?, 'Workspace C', 'workspace-business-c', 'active', ?, ?)
    `).run(workspaceC, timestamp, timestamp);
    db.prepare(`
      INSERT INTO workspace_memberships (
        id, workspace_id, user_id, role, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'admin', 'active', ?, ?)
    `).run(crypto.randomUUID(), workspaceC, userA.data.user.id, timestamp, timestamp);

    const switched = await request("/api/workspaces/active", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ workspaceId: workspaceC }),
    });
    assert.equal(switched.status, 200);
    const empty = await request("/api/business-profile", { headers: headersA });
    assert.equal((await empty.json()).profile, null);
    const created = await request("/api/business-profile", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ name: "Business C" }),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).profile.name, "Business C");

    await request("/api/workspaces/active", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ workspaceId: userA.data.activeWorkspace.id }),
    });
    const original = await request("/api/business-profile", { headers: headersA });
    assert.equal((await original.json()).profile.name, "Acme A Updated");
  });

  await t.test("database relationships remain valid", () => {
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });

  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
