import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { createPlatformAdminRouter, createPlatformGrantResolver } from "../app/routes/platform-admin.mjs";

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
});
