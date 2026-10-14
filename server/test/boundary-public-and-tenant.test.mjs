import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

// Black-box boundary tests against the REAL server wiring (server/index.mjs): the order of
// middleware is the security model, so it is exercised, not re-implemented. A test-only
// preload records every mounted route so nothing depends on a hand-maintained list.
//
// Guarantees pinned here:
//  1. Every route outside the public allowlist rejects an anonymous caller (401).
//  2. The public surface is exactly the allowlist below: adding a public route fails this test
//     until the change is reviewed and the list updated on purpose.
//  3. Anonymous callers reach only the intended read surface of a published site; session-bound
//     routes answer 401; nothing answers 5xx.
//  4. Operator B can neither read nor change operator A's data using A's real identifiers, and a
//     foreign identifier is indistinguishable from one that does not exist (no existence oracle).

const SERVER_DIR = fileURLToPath(new URL("..", import.meta.url));

export const PUBLIC_ROUTES = [
  "DELETE /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me/addresses/:addressId",
  "DELETE /api/auth/public/apps/:projectId/data/:entityId/:recordId",
  "DELETE /api/auth/site/:siteProjectId/patient/documents/:documentId",
  "GET /api/auth/me",
  "GET /api/auth/public/apps/:projectId/bootstrap",
  "GET /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me",
  "GET /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me/orders",
  "GET /api/auth/public/apps/:projectId/data/:entityId",
  "GET /api/auth/public/apps/:projectId/data/:entityId/:recordId",
  "GET /api/auth/public/apps/:projectId/education/sites/:siteProjectId/appointments",
  "GET /api/auth/public/apps/:projectId/education/sites/:siteProjectId/resources",
  "GET /api/auth/public/apps/:projectId/education/sites/:siteProjectId/resources/:mediaId/file",
  "GET /api/auth/site/:siteProjectId",
  "GET /api/auth/site/:siteProjectId/booking/catalog",
  "GET /api/auth/site/:siteProjectId/booking/confirmations/:reference",
  "GET /api/auth/site/:siteProjectId/booking/services",
  "GET /api/auth/site/:siteProjectId/booking/services/:serviceId/providers",
  "GET /api/auth/site/:siteProjectId/booking/slots",
  "GET /api/auth/site/:siteProjectId/doctor/appointments",
  "GET /api/auth/site/:siteProjectId/doctor/appointments/:appointmentId/consultation",
  "GET /api/auth/site/:siteProjectId/doctor/appointments/:appointmentId/documents",
  "GET /api/auth/site/:siteProjectId/doctor/availability",
  "GET /api/auth/site/:siteProjectId/doctor/documents/:documentId/file",
  "GET /api/auth/site/:siteProjectId/doctor/me",
  "GET /api/auth/site/:siteProjectId/patient/appointments",
  "GET /api/auth/site/:siteProjectId/patient/appointments/:appointmentId/consultation",
  "GET /api/auth/site/:siteProjectId/patient/appointments/:appointmentId/documents",
  "GET /api/auth/site/:siteProjectId/patient/config",
  "GET /api/auth/site/:siteProjectId/patient/documents/:documentId/file",
  "GET /api/auth/site/:siteProjectId/patient/me",
  "GET /api/auth/sites/:id",
  "GET /api/auth/sites/:id/:slug",
  "GET /api/auth/sites/:id/:slug/:detail",
  "GET /api/auth/status",
  "GET /api/auth/storefront/:siteProjectId",
  "GET /api/auth/storefront/:siteProjectId/checkout-options",
  "GET /api/auth/storefront/:siteProjectId/products",
  "GET /api/auth/storefront/:siteProjectId/products/:slug",
  "GET /api/auth/storefront/carts/:cartId",
  "GET /api/auth/storefront/orders/:orderId",
  "GET /api/auth/storefront/payments/:attemptId/callback",
  "GET /api/health",
  "PATCH /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me",
  "PATCH /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me/addresses/:addressId",
  "PATCH /api/auth/public/apps/:projectId/data/:entityId/:recordId",
  "PATCH /api/auth/site/:siteProjectId/doctor/availability/:availabilityId",
  "POST /api/auth/logout",
  "POST /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me",
  "POST /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me/addresses",
  "POST /api/auth/public/apps/:projectId/data/:entityId",
  "POST /api/auth/public/apps/:projectId/invite/exchange",
  "POST /api/auth/send-otp",
  "POST /api/auth/site/:siteProjectId/booking/appointments",
  "POST /api/auth/site/:siteProjectId/booking/review",
  "POST /api/auth/site/:siteProjectId/doctor/appointments/:appointmentId/consultation/complete",
  "POST /api/auth/site/:siteProjectId/doctor/appointments/:appointmentId/consultation/missed",
  "POST /api/auth/site/:siteProjectId/doctor/appointments/:appointmentId/consultation/start",
  "POST /api/auth/site/:siteProjectId/doctor/appointments/:appointmentId/status",
  "POST /api/auth/site/:siteProjectId/doctor/availability",
  "POST /api/auth/site/:siteProjectId/doctor/logout",
  "POST /api/auth/site/:siteProjectId/doctor/otp",
  "POST /api/auth/site/:siteProjectId/doctor/verify",
  "POST /api/auth/site/:siteProjectId/leads",
  "POST /api/auth/site/:siteProjectId/patient/appointments/:appointmentId/documents",
  "POST /api/auth/site/:siteProjectId/patient/logout",
  "POST /api/auth/site/:siteProjectId/patient/otp",
  "POST /api/auth/site/:siteProjectId/patient/verify",
  "POST /api/auth/storefront/:siteProjectId/carts",
  "POST /api/auth/storefront/carts/:cartId/checkout",
  "POST /api/auth/storefront/carts/:cartId/coupon",
  "POST /api/auth/storefront/carts/:cartId/items",
  "POST /api/auth/storefront/carts/:cartId/shipping",
  "POST /api/auth/storefront/orders/:orderId/pay",
  "POST /api/auth/verify-otp",
  "PUT /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me/addresses/:addressId/defaults",
  "PUT /api/auth/public/apps/:projectId/commerce/stores/:siteProjectId/me/carts/:cartId/binding",
  "PUT /api/auth/site/:siteProjectId/doctor/appointments/:appointmentId/consultation/join-link",
  "PUT /api/auth/storefront/carts/:cartId/items/:variantId",
];

// What an anonymous visitor may read/do on a PUBLISHED site (everything else must not succeed).
const ANONYMOUS_2XX = [
  "GET /api/auth/status",
  "GET /api/auth/sites/:id",
  "GET /api/auth/sites/:id/:slug",
  "GET /api/auth/sites/:id/:slug/:detail",
  "GET /api/auth/site/:siteProjectId",
  "GET /api/auth/site/:siteProjectId/patient/config",
  "POST /api/auth/site/:siteProjectId/patient/logout",
  "GET /api/auth/site/:siteProjectId/booking/catalog",
  "GET /api/auth/site/:siteProjectId/booking/services",
  "GET /api/auth/site/:siteProjectId/booking/services/:serviceId/providers",
  "GET /api/auth/site/:siteProjectId/booking/slots",
  "POST /api/auth/logout",
  "GET /api/health",
].sort();

const isPublic = (path) => path.startsWith("/api/auth/") || path === "/api/health";
const UNKNOWN = { siteProjectId: "11111111-1111-4111-8111-111111111111", id: "11111111-1111-4111-8111-111111111111", serviceId: "22222222-2222-4222-8222-222222222222", providerId: "33333333-3333-4333-8333-333333333333", appointmentId: "44444444-4444-4444-8444-444444444444" };
const norm = (j) => JSON.stringify(j ?? {}).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "ID").replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "TS");

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

let child, base, dir, routes, A, B, ids;
const logs = [];

async function call(cookie, method, path, body) {
  const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? (method === "GET" || method === "HEAD" ? undefined : "{}") : JSON.stringify(body) });
  let json = null; try { json = await res.clone().json(); } catch { /* HTML or empty */ }
  return { status: res.status, json };
}

async function signIn(mobile, name) {
  const challenge = await call(null, "POST", "/api/auth/send-otp", { mobile, name });
  const verify = await fetch(base + "/api/auth/verify-otp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mobile, code: challenge.json.developmentOtp }) });
  assert.equal(verify.status, 200);
  return verify.headers.get("set-cookie").split(";")[0];
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "loadder-boundary-"));
  const port = await freePort();
  const inventoryFile = join(dir, "routes.json");
  child = spawn(process.execPath, ["--import", "./test-helpers/route-inventory-preload.mjs", "index.mjs"], {
    cwd: SERVER_DIR, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "test", API_HOST: "127.0.0.1", API_PORT: String(port), DATABASE_PATH: join(dir, "b.sqlite"), SITE_MEDIA_LOCAL_DIR: join(dir, "media"), MEDICAL_DOCUMENT_DEV_DIR: join(dir, "medical"), LOADDER_OBJECT_STORAGE_DIR: join(dir, "objects"), AUTH_EXPOSE_DEV_OTP: "true", AUTH_HASH_SECRET: "boundary-test-secret", BUSINESS_BUILDER_PUBLIC_APPS_ENABLED: "true", ROUTE_INVENTORY_FILE: inventoryFile },
  });
  child.stdout.on("data", (d) => logs.push(String(d))); child.stderr.on("data", (d) => logs.push(String(d)));
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* starting */ } await tick(500); }
  routes = [...new Map(JSON.parse(readFileSync(inventoryFile, "utf8")).map((r) => [`${r.method} ${r.path}`, r])).values()];

  A = await signIn("09121110001", "Alpha");
  B = await signIn("09122220002", "Beta");
  const site = (await call(A, "POST", "/api/site-projects", { name: "A clinic", siteType: "MEDICAL", content: {} })).json.project.id;
  const service = (await call(A, "POST", "/api/booking/services", { siteProjectId: site, name: "A svc", durationMinutes: 30, modalities: ["IN_PERSON"] })).json.service.id;
  const provider = (await call(A, "POST", "/api/booking/providers", { siteProjectId: site, name: "A doc" })).json.provider.id;
  await call(A, "POST", `/api/booking/providers/${provider}/services/${service}`, { siteProjectId: site });
  await call(A, "POST", "/api/booking/availability", { siteProjectId: site, providerId: provider, weekday: 1, startsAt: "10:00", endsAt: "11:00", capacity: 2 });
  const appointment = (await call(A, "POST", "/api/booking/appointments", { siteProjectId: site, providerId: provider, serviceId: service, customerName: "Pat", startsAt: "2030-01-07T10:00:00.000Z" })).json.appointment.id;
  ids = { siteProjectId: site, id: site, serviceId: service, providerId: provider, appointmentId: appointment };
  assert.equal((await call(A, "POST", `/api/site-projects/${site}/publish`)).status, 200);
  assert.equal((await call(A, "POST", `/api/site-projects/${site}/patient-identity`)).status, 201);
});

after(() => { child?.kill("SIGTERM"); if (dir) rmSync(dir, { recursive: true, force: true }); });

const fill = (path, map, fallback = "x") => path.replace(/:([A-Za-z0-9_]+)/g, (_, k) => map[k] || fallback);
const withQuery = (route, url, siteId) => (route.method === "GET" && route.path.includes("/booking") ? `${url}?siteProjectId=${siteId}` : url);

test("the recorder sees the real surface and the public allowlist is exactly the reviewed list", () => {
  assert.ok(routes.length > 300, `expected the full mounted surface, saw ${routes.length}`);
  const publicNow = routes.filter((r) => isPublic(r.path)).map((r) => `${r.method} ${r.path}`).sort();
  assert.deepEqual(publicNow, [...PUBLIC_ROUTES].sort(), "the public surface changed: review it, then update PUBLIC_ROUTES on purpose");
});

test("every non-public route rejects an anonymous caller", async () => {
  const bad = [];
  for (const r of routes.filter((x) => !isPublic(x.path))) {
    const res = await call(null, r.method, fill(r.path, UNKNOWN));
    if (res.status !== 401) bad.push(`${res.status} ${r.method} ${r.path}`);
  }
  assert.deepEqual(bad, [], "routes reachable without a session");
});

test("anonymous visitors reach only the intended read surface of a published site; session routes are 401; no 5xx", async () => {
  const ok = [], serverErrors = [];
  let session401 = 0;
  for (const r of routes.filter((x) => isPublic(x.path))) {
    const url = fill(r.path, ids);
    const res = await call(null, r.method, r.method === "GET" && url.includes("/booking/slots") ? `${url}?serviceId=${ids.serviceId}&providerId=${ids.providerId}&date=2030-01-07` : url);
    if (res.status >= 200 && res.status < 300) ok.push(`${r.method} ${r.path}`);
    if (res.status >= 500) serverErrors.push(`${res.status} ${r.method} ${r.path}`);
    if (res.status === 401) session401 += 1;
  }
  assert.deepEqual(ok.sort(), ANONYMOUS_2XX, "anonymous callers can now do something new");
  assert.deepEqual(serverErrors, []);
  assert.ok(session401 >= 20, `patient/doctor session routes must answer 401 anonymously (saw ${session401})`);
});

test("operator B cannot read or change operator A's data; a foreign id is indistinguishable from an unknown id", async () => {
  const markers = [ids.siteProjectId, ids.serviceId, ids.providerId, ids.appointmentId, "A clinic", "A svc", "A doc", "Pat"];
  const leaks = [], oracle = [];
  let compared = 0;
  for (const r of routes.filter((x) => !isPublic(x.path))) {
    const withA = fill(r.path, ids), withUnknown = fill(r.path, UNKNOWN);
    if (withA === withUnknown) continue;           // no identifier of A's is involved
    compared += 1;
    const foreign = await call(B, r.method, withQuery(r, withA, ids.siteProjectId));
    const unknown = await call(B, r.method, withQuery(r, withUnknown, UNKNOWN.siteProjectId));
    const body = JSON.stringify(foreign.json ?? {});
    if (markers.some((m) => body.includes(m))) leaks.push(`${r.method} ${r.path}: response contains A's data`);
    if (foreign.status !== unknown.status || norm(foreign.json) !== norm(unknown.json)) oracle.push(`${r.method} ${r.path}: foreign ${foreign.status} vs unknown ${unknown.status}`);
  }
  assert.ok(compared > 150, `expected a broad comparison, made ${compared}`);
  assert.deepEqual(leaks, [], "cross-workspace data exposure");
  assert.deepEqual(oracle, [], "a foreign identifier is distinguishable from a nonexistent one");

  // And nothing of A's was changed by any of it.
  const site = await call(A, "GET", `/api/site-projects/${ids.siteProjectId}`);
  assert.equal(site.status, 200);
  assert.equal(site.json.project.name, "A clinic");
  const booking = (await call(A, "GET", `/api/booking?siteProjectId=${ids.siteProjectId}`)).json;
  assert.deepEqual(booking.services.map((s) => s.name), ["A svc"]);
  assert.deepEqual(booking.providers.map((p) => p.name), ["A doc"]);
  const appointment = booking.appointments.find((a) => a.id === ids.appointmentId);
  assert.ok(appointment, "A's appointment still exists");
  assert.equal(appointment.status, "PENDING");
});
