import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthService, SESSION_COOKIE_NAME } from "../app/services/auth-service.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";
import { createPlatformAdminRouter, createPlatformGrantResolver, createPlatformAdminReadModel } from "../app/routes/platform-admin.mjs";

function startApp({ user, grants, overview = { users:{ total:1, active:1, evidence:"persisted" } }, auditRepository }) {
  const audits = [];
  const app = express();
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use("/api/platform-admin", createPlatformAdminRouter({
    readModel:{ overview:() => overview },
    auditRepository:auditRepository || { createAuditLog(entry){ audits.push(entry); return "audit-1"; } },
    resolvePlatformGrant:createPlatformGrantResolver(JSON.stringify(grants || {})),
    now:() => "2026-09-06T00:00:00.000Z",
  }));
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve({ server, port:server.address().port, audits }));
  });
}

async function close(server) { await new Promise((resolve) => server.close(resolve)); }

test("platform grant resolver is default-deny and ignores invalid roles", () => {
  const resolve = createPlatformGrantResolver(JSON.stringify({
    "user-1":["platform_support","workspace_admin","platform_support"],
  }));
  assert.equal(resolve({id:"unknown"}), null);
  assert.deepEqual(resolve({id:"user-1"}), { userId:"user-1", roles:["platform_support"] });
  assert.equal(createPlatformGrantResolver("not-json")({id:"user-1"}), null);
});

test("workspace-only user cannot cross the platform-admin boundary", async (t) => {
  const { server, port, audits } = await startApp({ user:{id:"workspace-owner"}, grants:{} });
  t.after(() => close(server));
  const response = await fetch(`http://127.0.0.1:${port}/api/platform-admin/overview`);
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.code, "PLATFORM_ADMIN_ACCESS_DENIED");
  assert.equal(audits.length, 0);
});

test("valid platform grant can read overview and the cross-tenant read is audited", async (t) => {
  const overview = {
    users:{total:4,active:3,evidence:"persisted"},
    workspaces:{total:2,active:2,evidence:"persisted"},
    projects:{status:"unavailable"},
  };
  const { server, port, audits } = await startApp({
    user:{id:"platform-user"},
    grants:{"platform-user":["platform_ops"]},
    overview,
  });
  t.after(() => close(server));
  const response = await fetch(`http://127.0.0.1:${port}/api/platform-admin/overview`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, "read-only");
  assert.deepEqual(body.roles,["platform_ops"]);
  assert.deepEqual(body.overview,overview);
  assert.equal(audits.length,1);
  assert.equal(audits[0].workspaceId,null);
  assert.equal(audits[0].userId,"platform-user");
  assert.equal(audits[0].action,"platform_admin.read_overview");
  assert.deepEqual(audits[0].metadata.roles,["platform_ops"]);
});

test("platform overview fails closed when audit evidence cannot be persisted", async (t) => {
  const { server, port } = await startApp({
    user:{id:"platform-user"},
    grants:{"platform-user":["platform_security"]},
    auditRepository:{ createAuditLog(){ throw new Error("audit unavailable"); } },
  });
  t.after(() => close(server));
  const response = await fetch(`http://127.0.0.1:${port}/api/platform-admin/overview`);
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.code, "PLATFORM_ADMIN_INTERNAL_ERROR");
  assert.equal(body.overview, undefined);
});

test("platform boundary composes with real session, workspace and audit infrastructure", async (t) => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db, [migration001Identity, migration004WorkspaceManagementAudit]);
  const repository = createIdentityRepository(db);
  const timestamp = "2026-09-07T10:00:00.000Z";
  const authService = createAuthService({ repository, otpHashSecret:"test-only-platform", now:() => new Date(timestamp) });
  const identities = {};
  for (const [index, role] of ["owner", "admin", "member", "platform"].entries()) {
    const identity = repository.createUserWorkspaceAndMembership({
      mobile:`0912000000${index}`, name:role, workspaceName:role, workspaceSlug:role, timestamp,
    });
    const workspaceId = identity.memberships[0].workspace.id;
    if (role === "platform") db.prepare("DELETE FROM workspace_memberships WHERE user_id = ?").run(identity.user.id);
    else db.prepare("UPDATE workspace_memberships SET role = ? WHERE user_id = ?").run(role, identity.user.id);
    const token = `isolated-${role}-session`;
    repository.createSession({userId:identity.user.id, tokenHash:createHash("sha256").update(token).digest("hex"),
      activeWorkspaceId:role === "platform" ? null : workspaceId, expiresAt:"2026-09-08T10:00:00.000Z", timestamp});
    identities[role] = { userId:identity.user.id, workspaceId, cookie:`${SESSION_COOKIE_NAME}=${token}` };
  }
  const app = express();
  app.use(createRequireAuth(authService));
  app.use("/api/platform-admin", createPlatformAdminRouter({
    readModel:createPlatformAdminReadModel(db), auditRepository:repository,
    resolvePlatformGrant:createPlatformGrantResolver(JSON.stringify({[identities.platform.userId]:["platform_ops"]})),
    now:() => timestamp,
  }));
  app.use(createRequireWorkspace(repository));
  app.get("/api/workspace-probe", (req,res) => res.json({workspaceId:req.workspace.id}));
  const server = await new Promise(resolve => {
    const listener = app.listen(0,"127.0.0.1",() => resolve(listener));
  });
  t.after(async () => { await close(server); db.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const audits = () => db.prepare("SELECT * FROM audit_logs").all();

  await t.test("missing and invalid session fail before platform grants", async () => {
    for (const cookie of ["", `${SESSION_COOKIE_NAME}=invalid`]) {
      const response = await fetch(`${url}/api/platform-admin/overview`, {headers:{cookie}});
      assert.equal(response.status,401);
    }
    assert.equal(audits().length,0);
  });
  for (const role of ["owner","admin","member"]) {
    await t.test(`${role} cannot escalate via client platform roles`, async () => {
      const response = await fetch(`${url}/api/platform-admin/overview?role=platform_super_admin`, {
        headers:{cookie:identities[role].cookie,"x-platform-role":"platform_super_admin","x-workspace-id":identities[role].workspaceId},
      });
      assert.equal(response.status,403);
      assert.equal((await response.json()).code,"PLATFORM_ADMIN_ACCESS_DENIED");
      assert.equal(audits().length,0);
    });
  }
  await t.test("platform grant needs no workspace and audits global scope without PII", async () => {
    for (const workspaceId of ["", identities.owner.workspaceId, "foreign-workspace"]) {
      const response = await fetch(`${url}/api/platform-admin/overview`, {
        headers:{cookie:identities.platform.cookie,"x-workspace-id":workspaceId},
      });
      assert.equal(response.status,200);
      const body = await response.json();
      assert.deepEqual(body.overview.users,{total:4,active:4,evidence:"persisted"});
      assert.equal(body.overview.projects.status,"unavailable");
      assert.equal(body.overview.readiness.status,"unknown");
      assert.deepEqual(Object.keys(body).sort(),["mode","overview","roles","success"]);
      assert.doesNotMatch(JSON.stringify(body),/091200|token_hash|mobile|email|isolated-/);
    }
    assert.equal(audits().length,3);
    for (const entry of audits()) {
      assert.equal(entry.workspace_id,null);
      assert.equal(entry.user_id,identities.platform.userId);
      assert.equal(entry.action,"platform_admin.read_overview");
      assert.deepEqual(JSON.parse(entry.metadata_json),{roles:["platform_ops"]});
    }
  });
  await t.test("workspace routes still require membership", async () => {
    const allowed = await fetch(`${url}/api/workspace-probe`,{headers:{cookie:identities.owner.cookie}});
    assert.equal(allowed.status,200);
    assert.equal((await allowed.json()).workspaceId,identities.owner.workspaceId);
    for (const headers of [
      {cookie:identities.platform.cookie},
      {cookie:identities.owner.cookie,"x-workspace-id":identities.admin.workspaceId},
    ]) assert.equal((await fetch(`${url}/api/workspace-probe`,{headers})).status,403);
  });
  await t.test("unsupported mutation methods cannot change canonical records", async () => {
    const snapshot = () => ["users","workspaces","workspace_memberships","audit_logs"].map(table => db.prepare(`SELECT * FROM ${table}`).all());
    const before = snapshot();
    for (const method of ["POST","PUT","PATCH","DELETE"]) {
      const response = await fetch(`${url}/api/platform-admin/overview`,{method,headers:{cookie:identities.platform.cookie}});
      assert.equal(response.ok,false);
    }
    assert.deepEqual(snapshot(),before);
  });
  await t.test("real audit storage failure does not disclose overview", async () => {
    db.exec("CREATE TRIGGER reject_admin_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    const response = await fetch(`${url}/api/platform-admin/overview`,{headers:{cookie:identities.platform.cookie}});
    assert.equal(response.status,500);
    assert.deepEqual(await response.json(),{success:false,code:"PLATFORM_ADMIN_INTERNAL_ERROR",message:"Unable to load platform administration overview."});
    assert.equal(audits().length,3);
  });
});
