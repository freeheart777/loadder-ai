import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteMediaRepository } from "../app/repositories/site-media-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteMediaService } from "../app/services/site-media-service.mjs";
import { createLearningAccessService } from "../app/services/learning-access-service.mjs";
import { createPublicEducationRouter } from "../app/routes/public-education.mjs";
import { createLearningEnrollmentsRouter } from "../app/routes/learning-enrollments.mjs";
import { LoadderAppUserAuth } from "../app/business-builder/app-user-auth.mjs";

const files = {
  pdf: { type: "document", mime: "application/pdf", name: "lesson.pdf", body: "%PDF-lesson" },
  mp3: { type: "audio", mime: "audio/mpeg", name: "lesson.mp3", body: "ID3-audio" },
  mp4: { type: "video", mime: "video/mp4", name: "lesson.mp4", body: "mp4-video" },
};

async function fixture() {
  const db = createSiteTestDb();
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES('app-1','ws-1','Students','students','fa-IR','ready','x','x'),('app-2','ws-2','Other','students','fa-IR','ready','x','x')").run();
  const objects = new Map();
  const storage = {
    publicAssetUrl: (key) => `https://cdn.example/${key}`,
    async readLocalAsset(encodedKey) {
      const key = Buffer.from(encodedKey, "base64url").toString("utf8");
      return objects.get(key) || Promise.reject(Object.assign(new Error("not found"), { code: "SITE_MEDIA_NOT_FOUND" }));
    },
  };
  const projectService = createSiteProjectService({ repository: createSiteProjectRepository(db), now: () => new Date("2026-10-02T00:00:00.000Z") });
  const mediaService = createSiteMediaService({ repository: createSiteMediaRepository(db), siteProjectService: projectService, storage });
  const access = createLearningAccessService({ db, mediaService });
  const auth = new LoadderAppUserAuth(db);
  const site = runWithWorkspace("ws-1", () => projectService.create({ name: "Academy", siteType: "EDUCATION", content: {} }));
  const keys = {};
  runWithWorkspace("ws-1", () => {
    for (const [name, file] of Object.entries(files)) {
      const key = keys[name] = `ws-1/${site.id}/${file.type}/secret-${name}-${file.name}`;
      objects.set(key, { body: Buffer.from(file.body), fileName: file.name, mimeType: file.mime });
      mediaService.completeUpload(site.id, { assetType: file.type, storageKey: key, mimeType: file.mime, sizeBytes: file.body.length, metadata: { visibility: "workspace", title: `منبع ${name}`, name: file.name } });
    }
    const publicKey = `ws-1/${site.id}/logo/logo.png`;
    objects.set(publicKey, { body: Buffer.from("png"), fileName: "logo.png", mimeType: "image/png" });
    mediaService.completeUpload(site.id, { assetType: "logo", storageKey: publicKey, mimeType: "image/png", sizeBytes: 3, metadata: {} });
  });
  const mk = (ws, projectId, email, role = "customer") => runWithWorkspace(ws, () => { const user = auth.createUser({ projectId, email, role }); return { user, token: auth.createSession(user.id).token }; });
  const student = mk("ws-1", "app-1", "student@x.test"), outsider = mk("ws-1", "app-1", "outsider@x.test"), staff = mk("ws-1", "app-1", "staff@x.test", "employee"), foreign = mk("ws-2", "app-2", "foreign@x.test");
  const enrollment = runWithWorkspace("ws-1", () => access.enroll(site.id, { authProjectId: "app-1", appUserId: student.user.id, actorUserId: "op" }));
  const app = express();
  app.use("/api/auth", createPublicEducationRouter({ db, accessService: access }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/auth/public/apps`;
  const get = (path, token) => fetch(`${base}${path}`, { headers: token ? { "X-Loadder-App-Token": token } : {} });
  return { db, site, keys, access, student, outsider, staff, foreign, enrollment, base, get, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("student portal denies unauthenticated, cross-workspace and non-entitled callers", async () => {
  const f = await fixture();
  try {
    const path = `/app-1/education/sites/${f.site.id}/resources`;
    assert.equal((await f.get(path)).status, 401);
    assert.equal((await f.get(path, "garbage")).status, 401);
    const outsider = await f.get(path, f.outsider.token);
    assert.equal(outsider.status, 403);
    assert.equal((await outsider.json()).code, "LEARNING_ENROLLMENT_REQUIRED");
    // A customer of another workspace cannot reach this site, nor reuse its token on app-1.
    assert.equal((await f.get(`/app-2/education/sites/${f.site.id}/resources`, f.foreign.token)).status, 404);
    assert.equal((await f.get(path, f.foreign.token)).status, 401);
    // Staff app users are never students, even by token.
    assert.equal((await f.get(path, f.staff.token)).status, 403);
    const media = runWithWorkspace("ws-1", () => f.access.listResourcesFor(f.site.id, { id: f.student.user.id, projectId: "app-1", role: "customer" }));
    assert.equal((await f.get(`/app-1/education/sites/${f.site.id}/resources/${media[0].id}/file`, f.outsider.token)).status, 403);
  } finally { await f.close(); f.db.close(); }
});

test("entitled student reads private resources without storage keys, and revocation closes access", async () => {
  const f = await fixture();
  try {
    const listed = await f.get(`/app-1/education/sites/${f.site.id}/resources`, f.student.token);
    assert.equal(listed.status, 200);
    const text = await listed.text(), { resources } = JSON.parse(text);
    assert.equal(resources.length, 3, "only private learning resources are listed, never the public logo");
    for (const key of Object.values(f.keys)) assert.equal(text.includes(key), false);
    assert.equal(/storageKey|storage_key|secret-/.test(text), false);
    for (const resource of resources) {
      const file = Object.values(files).find((entry) => entry.type === resource.assetType);
      const download = await f.get(`/app-1/education/sites/${f.site.id}/resources/${resource.id}/file`, f.student.token);
      assert.equal(download.status, 200);
      assert.equal(await download.text(), file.body);
      assert.equal(download.headers.get("content-type").startsWith(file.mime), true);
      assert.match(download.headers.get("content-disposition"), /^attachment/);
      assert.equal(download.headers.get("cache-control"), "private, no-store");
      assert.equal(/secret-/.test([...download.headers.values()].join("|")), false);
      const inline = await f.get(`/app-1/education/sites/${f.site.id}/resources/${resource.id}/file?disposition=inline`, f.student.token);
      assert.match(inline.headers.get("content-disposition"), file.type === "document" ? /^attachment/ : /^inline/);
    }
    runWithWorkspace("ws-1", () => f.access.revoke(f.site.id, f.enrollment.id));
    assert.equal((await f.get(`/app-1/education/sites/${f.site.id}/resources`, f.student.token)).status, 403);
  } finally { await f.close(); f.db.close(); }
});

test("enrolment only accepts customer app users of an education site in the same workspace", async () => {
  const f = await fixture();
  try {
    const enroll = (ws, input) => runWithWorkspace(ws, () => f.access.enroll(f.site.id, input));
    assert.throws(() => enroll("ws-1", { authProjectId: "app-1", appUserId: f.staff.user.id }), (e) => e.code === "LEARNING_ENROLLMENT_TARGET_INVALID");
    assert.throws(() => enroll("ws-1", { authProjectId: "app-1", appUserId: f.foreign.user.id }), (e) => e.code === "LEARNING_ENROLLMENT_TARGET_INVALID");
    assert.throws(() => enroll("ws-2", { authProjectId: "app-2", appUserId: f.foreign.user.id }), (e) => e.code === "SITE_PROJECT_NOT_FOUND");
  } finally { await f.close(); f.db.close(); }
});

test("only workspace operators manage enrolments or preview learning resources", async () => {
  const f = await fixture();
  try {
    f.db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role) VALUES('m1','ws-1','owner-1','active','owner'),('m2','ws-1','member-1','active','member')").run();
    let actor = "owner-1";
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: actor }; runWithWorkspace("ws-1", next); });
    app.use(createLearningEnrollmentsRouter({ service: f.access, db: f.db }));
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    try {
      const url = `http://127.0.0.1:${server.address().port}/site-projects/${f.site.id}/learning-enrollments`;
      const body = JSON.stringify({ authProjectId: "app-1", appUserId: f.outsider.user.id });
      const headers = { "content-type": "application/json" };
      actor = "member-1";
      assert.equal((await fetch(url, { method: "POST", headers, body })).status, 403);
      assert.equal((await fetch(url)).status, 403);
      actor = "owner-1";
      const created = await fetch(url, { method: "POST", headers, body });
      assert.equal(created.status, 201);
      assert.equal((await fetch(url)).status === 200, true);
      assert.equal((await f.get(`/app-1/education/sites/${f.site.id}/resources`, f.outsider.token)).status, 200);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  } finally { await f.close(); f.db.close(); }
});

test("private resources get no public url or storage key in the media library, and candidates are real customers", async () => {
  const f = await fixture();
  try {
    const mediaService = createSiteMediaService({ repository: createSiteMediaRepository(f.db), siteProjectService: createSiteProjectService({ repository: createSiteProjectRepository(f.db) }), storage: { publicAssetUrl: (key) => `https://cdn.example/${key}` } });
    const listed = runWithWorkspace("ws-1", () => mediaService.list(f.site.id));
    const text = JSON.stringify(listed);
    for (const key of Object.values(f.keys)) assert.equal(text.includes(key), false);
    const privateAssets = listed.filter((asset) => ["document", "audio", "video"].includes(asset.assetType));
    assert.equal(privateAssets.length, 3);
    for (const asset of privateAssets) { assert.equal(asset.url, null); assert.equal("storageKey" in asset, false); }
    assert.match(listed.find((asset) => asset.assetType === "logo").url, /^https:\/\/cdn\.example\//);

    const candidates = runWithWorkspace("ws-1", () => f.access.listCandidates(f.site.id));
    assert.deepEqual(candidates.map((entry) => entry.email).sort(), ["outsider@x.test"], "enrolled students and staff are not candidates; other workspaces never appear");
    const enrollments = runWithWorkspace("ws-1", () => f.access.listEnrollments(f.site.id));
    assert.equal(enrollments.length, 1);
    assert.equal(enrollments[0].student.email, "student@x.test");
    assert.equal(enrollments[0].authProjectName, "Students");
    assert.throws(() => runWithWorkspace("ws-2", () => f.access.listCandidates(f.site.id)), (e) => e.code === "SITE_PROJECT_NOT_FOUND");
  } finally { await f.close(); f.db.close(); }
});
