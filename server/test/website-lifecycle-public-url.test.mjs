import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteProjectsRouter } from "../app/routes/site-projects.mjs";
import { createPublicSitesRouter } from "../app/routes/public-sites.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { parsePublicSiteBaseUrl } from "../app/config/environment.mjs";
import { previewSiteUrl, projectPublicUrl, publicSiteUrl } from "../app/services/public-site-urls.mjs";
import { DEFAULT_SITE_MEDIA_LOCAL_DIR } from "../app/services/site-media-storage-adapter.mjs";
import { migration092SiteProjectGlobalSlug } from "../db/migrations/092_site_project_global_slug.mjs";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) };
const doc = (title) => ({ storeBuilderV16: { version: 16, header: { storeName: title }, sections: [{ id: "a", type: "about", enabled: true, title, subtitle: "" }] } });
const setup = () => {
  const db = createSiteTestDb();
  const repository = createSiteProjectRepository(db);
  return { db, repository, service: createSiteProjectService({ repository, businessContextService: context }) };
};

test("public URL helpers build /s/:slug and absolute preview URLs", () => {
  assert.equal(publicSiteUrl("https://sites.example.com/", "clinic"), "https://sites.example.com/s/clinic");
  assert.equal(publicSiteUrl("https://sites.example.com", "کلینیک-نور"), `https://sites.example.com/s/${encodeURIComponent("کلینیک-نور")}`);
  assert.equal(previewSiteUrl("http://127.0.0.1:3002", "p 1", "t/k"), "http://127.0.0.1:3002/preview/sites/p%201?token=t%2Fk");
  assert.equal(projectPublicUrl("https://x.test", { status: "DRAFT", slug: "a" }), null, "never published: no public URL");
  assert.equal(projectPublicUrl("https://x.test", { status: "PUBLISHED", slug: "a" }), "https://x.test/s/a");
  assert.equal(publicSiteUrl("", "a"), null);
});

test("PUBLIC_SITE_BASE_URL is validated and normalised", () => {
  assert.equal(parsePublicSiteBaseUrl("", "http://127.0.0.1:3002"), "http://127.0.0.1:3002");
  assert.equal(parsePublicSiteBaseUrl("https://sites.loadder.ir/", "x"), "https://sites.loadder.ir");
  assert.equal(parsePublicSiteBaseUrl("https://loadder.ir/sites/", "x"), "https://loadder.ir/sites");
  assert.throws(() => parsePublicSiteBaseUrl("ftp://loadder.ir", "x"), /http or https/);
  assert.throws(() => parsePublicSiteBaseUrl("not a url", "x"), /absolute http\(s\) URL/);
});

test("local media root does not depend on the process working directory", () => {
  assert.equal(DEFAULT_SITE_MEDIA_LOCAL_DIR, path.join(serverDir, "data", "site-media"));
  const adapterUrl = new URL("../app/services/site-media-storage-adapter.mjs", import.meta.url).href;
  for (const cwd of [os.tmpdir(), serverDir, path.join(serverDir, "..")]) {
    const resolved = execFileSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(adapterUrl)}); process.stdout.write(m.DEFAULT_SITE_MEDIA_LOCAL_DIR);`], { cwd }).toString();
    assert.equal(resolved, DEFAULT_SITE_MEDIA_LOCAL_DIR, `cwd=${cwd}`);
  }
});

test("migration 092 de-duplicates slugs across workspaces and enforces global uniqueness", () => {
  const db = createSiteTestDb({ maxVersion: 91 });
  const insert = db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,'DRAFT','{}',?,?)");
  insert.run("aaa-old", "ws-1", "Clinic", "BUSINESS", "clinic", "2026-01-01", "2026-01-01");
  insert.run("bbb-new", "ws-2", "Clinic", "BUSINESS", "clinic", "2026-02-01", "2026-02-01");
  insert.run("ccc-uniq", "ws-2", "Law", "BUSINESS", "law", "2026-02-01", "2026-02-01");
  migration092SiteProjectGlobalSlug.up(db);
  migration092SiteProjectGlobalSlug.up(db); // idempotent
  const slugs = Object.fromEntries(db.prepare("SELECT id, slug FROM site_projects").all().map((r) => [r.id, r.slug]));
  assert.equal(slugs["aaa-old"], "clinic", "oldest keeps its slug");
  assert.equal(slugs["bbb-new"], "clinic-bbbnew", "later duplicate gets an id-derived suffix");
  assert.equal(slugs["ccc-uniq"], "law", "unique slugs are untouched");
  assert.throws(() => insert.run("ddd", "ws-1", "Law", "BUSINESS", "law", "2026-03-01", "2026-03-01"), /UNIQUE constraint failed/);
});

test("slug generation is collision-safe within and across workspaces", () => {
  const { db, service } = setup();
  const first = runWithWorkspace("ws-1", () => service.create({ name: "Clinic", siteType: "BUSINESS", content: doc("Clinic") }));
  const sameWorkspace = runWithWorkspace("ws-1", () => service.create({ name: "Clinic", siteType: "BUSINESS", content: doc("Clinic") }));
  const otherWorkspace = runWithWorkspace("ws-2", () => service.create({ name: "Clinic", siteType: "BUSINESS", content: doc("Clinic") }));
  assert.equal(first.slug, "clinic");
  assert.match(sameWorkspace.slug, /^clinic-[0-9a-f]{6}$/, "same workspace: no 500, a suffixed slug");
  assert.match(otherWorkspace.slug, /^clinic-[0-9a-f]{6}$/, "other workspace: globally unique too");
  assert.equal(new Set([first.slug, sameWorkspace.slug, otherWorkspace.slug]).size, 3);
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='ux_site_projects_slug'").get(), "global unique index exists");
});

test("an explicit slug change never silently takes another site's address", () => {
  const { service } = setup();
  const taken = runWithWorkspace("ws-2", () => service.create({ name: "Legal", siteType: "BUSINESS", content: doc("Legal") }));
  const mine = runWithWorkspace("ws-1", () => service.create({ name: "Mine", siteType: "BUSINESS", content: doc("Mine") }));
  runWithWorkspace("ws-1", () => {
    assert.throws(() => service.update(mine.id, { slug: taken.slug }), (error) => error.status === 409 && error.code === "SITE_SLUG_TAKEN");
    assert.equal(service.update(mine.id, { slug: "mine" }).slug, "mine", "re-saving its own slug is fine");
    assert.equal(service.update(mine.id, { slug: "Brand New" }).slug, "brand-new");
  });
});

test("full lifecycle over HTTP: create → preview link → publish → public /s/:slug", async () => {
  const { repository, service } = setup();
  const publicSiteBaseUrl = "http://sites.test";
  const api = express();
  api.use(express.json());
  api.use((req, res, next) => runWithWorkspace("ws-1", next));
  api.use("/api", createSiteProjectsRouter({ service, publicSiteBaseUrl }));
  const publicApp = express();
  publicApp.use(createPublicSitesRouter({ repository }));
  const servers = [api.listen(0, "127.0.0.1"), publicApp.listen(0, "127.0.0.1")];
  await Promise.all(servers.map((s) => once(s, "listening")));
  after(() => servers.forEach((s) => s.close()));
  const [apiBase, publicBase] = servers.map((s) => `http://127.0.0.1:${s.address().port}`);
  const json = async (url, init) => { const res = await fetch(url, init); return { status: res.status, body: await res.json() }; };
  const onPublic = (url) => url.replace(publicSiteBaseUrl, publicBase);

  const created = await json(`${apiBase}/api/site-projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Noor Clinic", siteType: "BUSINESS", content: doc("کلینیک نور") }) });
  assert.equal(created.status, 201);
  const { id, slug } = created.body.project;

  const draftDetail = await json(`${apiBase}/api/site-projects/${id}`);
  assert.equal(draftDetail.body.publicUrl, null, "no public URL before first publish");
  assert.equal((await fetch(`${publicBase}/s/${slug}`)).status, 404, "a draft is never public by slug");

  const preview = await json(`${apiBase}/api/site-projects/${id}/preview-token`, { method: "POST" });
  assert.equal(preview.status, 201);
  assert.match(preview.body.previewUrl, new RegExp(`^${publicSiteBaseUrl}/preview/sites/${id}\\?token=`), "absolute preview URL on the public base");
  const previewPage = await fetch(onPublic(preview.body.previewUrl));
  assert.equal(previewPage.status, 200);
  assert.match(await previewPage.text(), /کلینیک نور/);

  const published = await json(`${apiBase}/api/site-projects/${id}/publish`, { method: "POST" });
  assert.equal(published.status, 200);
  assert.equal(published.body.publicUrl, `${publicSiteBaseUrl}/s/${slug}`);
  assert.equal((await json(`${apiBase}/api/site-projects/${id}`)).body.publicUrl, published.body.publicUrl, "detail reports the same URL");

  const live = await fetch(onPublic(published.body.publicUrl));
  assert.equal(live.status, 200);
  const html = await live.text();
  assert.match(html, /کلینیک نور/);
  assert.equal((await fetch(`${publicBase}/s/${slug}/no-such-page`)).status, 404, "unknown page under a slug is a 404");
  assert.equal((await fetch(`${publicBase}/s/unknown-slug`)).status, 404);
  assert.equal((await fetch(`${publicBase}/sites/${id}`)).status, 200, "internal /sites/:id route still works");
});

function after(fn) { test.after(fn); }
