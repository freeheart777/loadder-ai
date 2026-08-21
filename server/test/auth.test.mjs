import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";

test("Phase 1 identity, session, workspace, and protection flow", async (t) => {
  const testDirectory = mkdtempSync(join(tmpdir(), "loadder-auth-"));
  const db = new Database(join(testDirectory, "auth.sqlite"));
  db.pragma("foreign_keys = ON");
  const authMigrations = [
    migration001Identity,
    migration004WorkspaceManagementAudit,
  ];
  runMigrations(db, authMigrations);
  runMigrations(db, authMigrations);

  let nowMs = Date.parse("2026-08-20T10:00:00.000Z");
  const repository = createIdentityRepository(db);
  const authService = createAuthService({
    repository,
    otpHashSecret: "test-only-secret",
    now: () => new Date(nowMs),
  });
  const app = express();
  app.use(express.json());
  app.use(
    "/api/auth",
    createAuthRouter({
      authService,
      nodeEnv: "test",
      exposeDevelopmentOtp: true,
    })
  );
  app.use(createRequireAuth(authService));
  app.use(createRequireWorkspace(repository));
  app.get("/api/crm/stats", (req, res) =>
    res.json({ ok: true, workspaceId: req.workspace.id })
  );
  app.get("/api/marketing/channels", (req, res) => res.json({ ok: true }));
  app.get("/api/automations", (req, res) => res.json({ ok: true }));
  app.post("/api/agent/run", (req, res) => res.json({ ok: true }));

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(path, options = {}) {
    return fetch(`${baseUrl}${path}`, options);
  }

  async function requestOtp(mobile, name) {
    const response = await request("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, name }),
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  async function verifyOtp(mobile, code) {
    return request("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, code }),
    });
  }

  let sessionCookie;
  let firstWorkspaceId;
  let consumedOtp;

  await t.test("migration is repeatable and preserves its version", () => {
    const rows = db.prepare("SELECT * FROM schema_migrations").all();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].version, 1);
    assert.equal(rows[1].version, 4);
  });

  await t.test("OTP request stores only a hash", async () => {
    const result = await requestOtp("09120000001", "کاربر تست");
    assert.match(result.developmentOtp, /^\d{5}$/);
    const stored = db
      .prepare("SELECT code_hash FROM otp_challenges WHERE mobile = ?")
      .get("09120000001");
    assert.notEqual(stored.code_hash, result.developmentOtp);
    assert.equal(stored.code_hash.length, 64);
  });

  await t.test("invalid OTP is rejected", async () => {
    const response = await verifyOtp("09120000001", "00000");
    assert.equal(response.status, 400);
  });

  await t.test("expired OTP is rejected", async () => {
    const result = await requestOtp("09120000002", "کاربر منقضی");
    nowMs += 3 * 60 * 1000;
    const response = await verifyOtp("09120000002", result.developmentOtp);
    assert.equal(response.status, 400);
  });

  await t.test("successful OTP creates user, owner workspace, and session", async () => {
    const result = await requestOtp("09120000001", "کاربر تست");
    consumedOtp = result.developmentOtp;
    const response = await verifyOtp("09120000001", result.developmentOtp);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.user.mobile, "09120000001");
    assert.equal(data.memberships[0].role, "owner");
    assert.equal(data.activeWorkspace.id, data.memberships[0].workspace.id);
    firstWorkspaceId = data.activeWorkspace.id;
    const setCookie = response.headers.get("set-cookie");
    sessionCookie = setCookie.split(";")[0];
    assert.match(sessionCookie, /^loadder_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Max-Age=/i);

    const storedSession = db.prepare("SELECT token_hash FROM sessions").get();
    assert.equal(storedSession.token_hash.length, 64);
    assert.ok(!sessionCookie.includes(storedSession.token_hash));
  });

  await t.test("consumed OTP cannot be replayed", async () => {
    const latest = db
      .prepare(
        "SELECT mobile FROM otp_challenges WHERE mobile = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get("09120000001");
    assert.ok(latest);
    const response = await verifyOtp("09120000001", consumedOtp);
    assert.equal(response.status, 400);
  });

  await t.test("auth/me resolves the server session", async () => {
    const response = await request("/api/auth/me", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.activeWorkspace.id, firstWorkspaceId);
  });

  await t.test("unauthenticated business and AI APIs are rejected", async () => {
    for (const [path, method] of [
      ["/api/crm/stats", "GET"],
      ["/api/marketing/channels", "GET"],
      ["/api/automations", "GET"],
      ["/api/agent/run", "POST"],
    ]) {
      const response = await request(path, { method });
      assert.equal(response.status, 401, path);
    }
  });

  await t.test("authenticated user resolves own workspace", async () => {
    const response = await request("/api/crm/stats", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.workspaceId, firstWorkspaceId);
  });

  await t.test("user cannot select another user's workspace", async () => {
    const secondOtp = await requestOtp("09120000003", "کاربر دوم");
    const secondResponse = await verifyOtp(
      "09120000003",
      secondOtp.developmentOtp
    );
    const secondData = await secondResponse.json();
    const response = await request("/api/crm/stats", {
      headers: {
        Cookie: sessionCookie,
        "X-Workspace-Id": secondData.activeWorkspace.id,
      },
    });
    assert.equal(response.status, 403);
  });

  await t.test("logout revokes session and revoked session is rejected", async () => {
    const logoutResponse = await request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    assert.equal(logoutResponse.status, 200);

    const meResponse = await request("/api/auth/me", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(meResponse.status, 401);

    const protectedResponse = await request("/api/crm/stats", {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(protectedResponse.status, 401);
  });

  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(testDirectory, { recursive: true, force: true });
});
