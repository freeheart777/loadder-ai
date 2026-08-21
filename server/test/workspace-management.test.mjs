import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createRequireAuth } from "../app/middleware/auth.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { assignLegacyWorkspaceOwner } from "../app/services/legacy-workspace-assignment.mjs";
import { createWorkspaceRuntimeStore } from "../app/services/workspace-runtime-store.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { LEGACY_WORKSPACE_ID } from "../db/migrations/002_tenant_domain_data.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";

test("Phase 1C workspace management and tenant hardening", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-workspaces-"));
  const db = new Database(join(directory, "workspaces.sqlite"));
  db.pragma("foreign_keys = ON");
  runMigrations(db, [migration001Identity, migration004WorkspaceManagementAudit]);

  let nowMs = Date.parse("2026-08-20T12:00:00.000Z");
  const now = () => new Date(nowMs);
  const repository = createIdentityRepository(db);
  const authService = createAuthService({
    repository,
    otpHashSecret: "workspace-test-secret",
    now,
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

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const { port } = server.address();
  const request = (path, options = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, options);

  async function register(mobile, name) {
    const otpResponse = await request("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, name }),
    });
    const otp = await otpResponse.json();
    const response = await request("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, code: otp.developmentOtp }),
    });
    const data = await response.json();
    return {
      data,
      cookie: response.headers.get("set-cookie").split(";")[0],
    };
  }

  const first = await register("09121111111", "Workspace User");
  const second = await register("09122222222", "Other User");
  const timestamp = now().toISOString();
  const extraWorkspaceId = "workspace-extra";
  db.prepare(`
    INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
    VALUES (?, 'Second Workspace', 'second-workspace', 'active', ?, ?)
  `).run(extraWorkspaceId, timestamp, timestamp);
  const extraMembershipId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO workspace_memberships (
      id, workspace_id, user_id, role, status, created_at, updated_at
    ) VALUES (?, ?, ?, 'admin', 'active', ?, ?)
  `).run(extraMembershipId, extraWorkspaceId, first.data.user.id, timestamp, timestamp);
  db.prepare(`
    INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
    VALUES (?, 'Legacy', 'legacy', 'active', ?, ?)
  `).run(LEGACY_WORKSPACE_ID, timestamp, timestamp);

  await t.test("lists only the authenticated user's workspaces", async () => {
    const response = await request("/api/workspaces", {
      headers: { Cookie: first.cookie },
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.workspaces.length, 2);
    assert.ok(!data.workspaces.some(({ id }) => id === LEGACY_WORKSPACE_ID));
    assert.ok(!data.workspaces.some(({ id }) => id === second.data.activeWorkspace.id));
  });

  await t.test("selects and persists an owned workspace", async () => {
    const response = await request("/api/workspaces/active", {
      method: "POST",
      headers: { Cookie: first.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: extraWorkspaceId }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).activeWorkspace.id, extraWorkspaceId);
    assert.equal(
      db.prepare("SELECT active_workspace_id FROM sessions WHERE user_id = ?").get(first.data.user.id).active_workspace_id,
      extraWorkspaceId
    );
    const me = await request("/api/auth/me", { headers: { Cookie: first.cookie } });
    assert.equal((await me.json()).activeWorkspace.id, extraWorkspaceId);
  });

  await t.test("rejects another user's workspace", async () => {
    const response = await request("/api/workspaces/active", {
      method: "POST",
      headers: { Cookie: first.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: second.data.activeWorkspace.id }),
    });
    assert.equal(response.status, 403);
  });

  await t.test("revoked active membership falls back safely", async () => {
    db.prepare("UPDATE workspace_memberships SET status = 'revoked' WHERE id = ?")
      .run(extraMembershipId);
    const response = await request("/api/auth/me", { headers: { Cookie: first.cookie } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.activeWorkspace.id, first.data.activeWorkspace.id);
    assert.equal(
      db.prepare("SELECT active_workspace_id FROM sessions WHERE user_id = ?").get(first.data.user.id).active_workspace_id,
      first.data.activeWorkspace.id
    );
  });

  await t.test("legacy assignment is explicit and idempotent", () => {
    const before = db.prepare(`
      SELECT COUNT(*) AS count FROM workspace_memberships WHERE workspace_id = ?
    `).get(LEGACY_WORKSPACE_ID).count;
    assert.equal(before, 0);
    const firstRun = assignLegacyWorkspaceOwner(db, first.data.user.mobile, timestamp);
    const secondRun = assignLegacyWorkspaceOwner(db, first.data.user.mobile, timestamp);
    assert.equal(firstRun.changed, true);
    assert.equal(secondRun.changed, false);
    assert.equal(db.prepare(`
      SELECT COUNT(*) AS count FROM workspace_memberships
      WHERE workspace_id = ? AND user_id = ? AND role = 'owner'
    `).get(LEGACY_WORKSPACE_ID, first.data.user.id).count, 1);
  });

  await t.test("audit records contain actions but no secrets", async () => {
    await request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: second.cookie },
    });
    const rows = db.prepare("SELECT action, metadata_json FROM audit_logs").all();
    assert.ok(rows.some(({ action }) => action === "auth.login"));
    assert.ok(rows.some(({ action }) => action === "auth.logout"));
    assert.ok(rows.some(({ action }) => action === "workspace.switch"));
    assert.ok(rows.some(({ action }) => action === "workspace.legacy_owner_assigned"));
    const serialized = JSON.stringify(rows).toLowerCase();
    for (const forbidden of [
      "developmentotp",
      "code_hash",
      "session_token",
      "token_hash",
      "api_key",
    ]) {
      assert.ok(!serialized.includes(forbidden), forbidden);
    }
  });

  await t.test("workspace runtime state is isolated for identical IDs", () => {
    const store = createWorkspaceRuntimeStore(() => ({ mode: "default" }));
    store.set("workspace-a", "campaign-1", { mode: "autopilot" });
    assert.equal(store.get("workspace-a", "campaign-1").mode, "autopilot");
    assert.equal(store.get("workspace-b", "campaign-1").mode, "default");
  });

  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
