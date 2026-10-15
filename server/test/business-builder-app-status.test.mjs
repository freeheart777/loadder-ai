import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

// An app is served to its invited users (invite exchange, public runtime, Education portal) only when its status is
// "ready" (the public-app gate). The operator opens and closes that gate explicitly; these tests run the real server.

const SERVER_DIR = fileURLToPath(new URL("..", import.meta.url));
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
let child, base, dir, A, B, appId;

async function call(cookie, method, path, body) {
  const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
}
async function signIn(mobile, name) {
  const sent = await call(null, "POST", "/api/auth/send-otp", { mobile, name });
  const verify = await fetch(base + "/api/auth/verify-otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mobile, code: sent.json.developmentOtp }) });
  return verify.headers.get("set-cookie").split(";")[0];
}
const exchange = (token) => call(null, "POST", `/api/auth/public/apps/${appId}/invite/exchange`, { token });

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "loadder-appstatus-"));
  const port = await freePort();
  child = spawn(process.execPath, ["index.mjs"], { cwd: SERVER_DIR, stdio: "ignore", env: { ...process.env, NODE_ENV: "test", API_HOST: "127.0.0.1", API_PORT: String(port), DATABASE_PATH: join(dir, "s.sqlite"), SITE_MEDIA_LOCAL_DIR: join(dir, "m"), LOADDER_OBJECT_STORAGE_DIR: join(dir, "o"), AUTH_EXPOSE_DEV_OTP: "true", AUTH_HASH_SECRET: "app-status-test", BUSINESS_BUILDER_PUBLIC_APPS_ENABLED: "true" } });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
  A = await signIn("09121110101", "Owner A"); B = await signIn("09121110102", "Owner B");
  appId = (await call(A, "POST", "/api/business-builder/projects", { intent: "student app", locale: "fa-IR" })).json.project.id;
});
after(() => { child?.kill("SIGTERM"); if (dir) rmSync(dir, { recursive: true, force: true }); });

test("a new app is closed to the public until the operator opens it, and closing it closes the gate again", async () => {
  assert.equal((await call(A, "GET", `/api/business-builder/projects/${appId}`)).json.project.status, "draft");
  assert.equal((await exchange("not-a-real-token")).status, 404, "draft apps are not served: the project is not even located");

  const opened = await call(A, "POST", `/api/business-builder/projects/${appId}/status`, { status: "ready" });
  assert.equal(opened.status, 200); assert.equal(opened.json.project.status, "ready");
  const afterOpen = await exchange("not-a-real-token");
  assert.equal(afterOpen.status, 401, "the app is now located; a wrong invite is refused as such");
  assert.equal(afterOpen.json.code, "APP_INVITE_INVALID");

  const closed = await call(A, "POST", `/api/business-builder/projects/${appId}/status`, { status: "draft" });
  assert.equal(closed.json.project.status, "draft");
  assert.equal((await exchange("not-a-real-token")).status, 404, "closed again");
});

test("only owners and admins of the app's own workspace can change it; bad input is refused", async () => {
  const path = `/api/business-builder/projects/${appId}/status`;
  assert.equal((await call(null, "POST", path, { status: "ready" })).status, 401, "anonymous");

  const foreign = await call(B, "POST", path, { status: "ready" });
  const unknown = await call(B, "POST", "/api/business-builder/projects/11111111-1111-4111-8111-111111111111/status", { status: "ready" });
  assert.deepEqual([foreign.status, foreign.json], [unknown.status, unknown.json], "a foreign app looks exactly like a nonexistent one");
  assert.equal(foreign.status, 404);
  assert.equal((await call(A, "GET", `/api/business-builder/projects/${appId}`)).json.project.status, "draft", "the foreign attempt changed nothing");

  for (const bad of ["published", "", undefined, 1, null]) {
    const res = await call(A, "POST", path, { status: bad });
    assert.equal(res.status, 400, `status ${JSON.stringify(bad)}`); assert.equal(res.json.code, "APP_STATUS_INVALID");
  }
  const source = readFileSync(join(SERVER_DIR, "app/routes/business-builder.mjs"), "utf8");
  const route = source.slice(source.indexOf('"/business-builder/projects/:id/status"'), source.indexOf('"/business-builder/projects/:id/versions/:versionId/restore"'));
  assert.match(route, /if\(!isAdmin\(q\)\)return s\.status\(403\)/, "same owner/admin guard as the access-policy route (members are refused)");
});

test("role matrix: owner and admin may change the status; an ordinary member gets 403, a foreign workspace 404, an anonymous caller 401; a refused request mutates nothing", async () => {
  const path = `/api/business-builder/projects/${appId}/status`;
  const statusOf = async () => (await call(A, "GET", `/api/business-builder/projects/${appId}`)).json.project.status;
  const gateOpen = async () => (await exchange("not-a-real-token")).status === 401;   // 401: app located (ready); 404: draft
  const set = (cookie, status) => call(cookie, "POST", path, { status });

  // There is no product API for adding members, so the two extra users get real membership rows in the OWNER's
  // workspace (the test owns this temporary database); they then use the product's own workspace switch.
  const workspaceId = (await call(A, "GET", "/api/workspaces")).json.activeWorkspace.id;
  const member = await signIn("09121110103", "Plain Member"), admin = await signIn("09121110104", "Workspace Admin");
  const db = new Database(join(dir, "s.sqlite"));
  try {
    for (const [cookie, role] of [[member, "member"], [admin, "admin"]]) {
      const userId = (await call(cookie, "GET", "/api/auth/me")).json.user.id;
      db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(`m-${role}-${userId}`, workspaceId, userId, "active", role, new Date().toISOString(), new Date().toISOString());
      assert.equal((await call(cookie, "POST", "/api/workspaces/active", { workspaceId })).status, 200, `${role} switches into the owner's workspace`);
    }
  } finally { db.close(); }
  // The member really is inside the workspace: they can read the app, so the refusal below is about role, not isolation.
  assert.equal((await call(member, "GET", `/api/business-builder/projects/${appId}`)).status, 200, "the member can see the app");

  // Start from a known state: draft.
  assert.equal((await set(A, "draft")).status, 200); assert.equal(await statusOf(), "draft");
  assert.equal(await gateOpen(), false);

  // Refused while draft: nothing opens.
  for (const [label, cookie, expected] of [["ordinary member", member, 403], ["foreign workspace", B, 404], ["anonymous", null, 401]]) {
    const res = await set(cookie, "ready");
    assert.equal(res.status, expected, `${label} cannot open the app`);
    assert.equal(await statusOf(), "draft", `${label}: status unchanged`);
    assert.equal(await gateOpen(), false, `${label}: the public gate stayed closed`);
  }
  assert.equal((await set(member, "ready")).json.code, "ADMIN_FORBIDDEN");

  // Owner opens; refused callers cannot close it again.
  assert.equal((await set(A, "ready")).status, 200); assert.equal(await gateOpen(), true);
  for (const [label, cookie, expected] of [["ordinary member", member, 403], ["foreign workspace", B, 404], ["anonymous", null, 401]]) {
    assert.equal((await set(cookie, "draft")).status, expected, `${label} cannot close the app`);
    assert.equal(await statusOf(), "ready", `${label}: status unchanged`);
    assert.equal(await gateOpen(), true, `${label}: the public gate stayed open`);
  }

  // An admin of the workspace may change it, in both directions.
  assert.equal((await set(admin, "draft")).status, 200); assert.equal(await statusOf(), "draft"); assert.equal(await gateOpen(), false);
  assert.equal((await set(admin, "ready")).status, 200); assert.equal(await statusOf(), "ready"); assert.equal(await gateOpen(), true);
  assert.equal((await set(A, "draft")).status, 200, "the owner can close it again");
  assert.equal(await statusOf(), "draft");
});
