import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createPublicSitesRouter, renderPublishedSite } from "../app/routes/public-sites.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

// The standalone public server has no workspace context; draft preview used to
// fail with "Workspace context is required" (HTTP 500) for every valid token.
const db = createSiteTestDb();
const repository = createSiteProjectRepository(db);
const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) } });
const doc = (title) => ({ storeBuilderV16: { version: 16, header: { storeName: title }, sections: [{ id: "a", type: "about", enabled: true, title, subtitle: "" }] } });

const [a, b] = [["ws-1", "شرکت الف"], ["ws-2", "شرکت ب"]].map(([ws, name]) => runWithWorkspace(ws, () => {
  const project = service.create({ name, siteType: "BUSINESS", content: doc(name) });
  return { project, token: service.createPreviewToken(project.id) };
}));

const app = express();
app.use(createPublicSitesRouter({ repository }));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const preview = async (id, token) => { const res = await fetch(`${base}/preview/sites/${id}?token=${token}`); return { status: res.status, headers: res.headers, html: await res.text() }; };

test("a valid preview token renders the draft outside any request workspace", async () => {
  const res = await preview(a.project.id, a.token);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  const draft = runWithWorkspace("ws-1", () => repository.get(a.project.id));
  assert.equal(res.html, renderPublishedSite(draft, { version: "draft", content: draft.content }, [], { slug: "", basePath: `/preview/sites/${a.project.id}` }, []), "same renderer output as before");
});

test("wrong, foreign or missing tokens never render", async () => {
  assert.equal((await preview(a.project.id, "x".repeat(40))).status, 404, "wrong token");
  assert.equal((await preview(a.project.id, b.token)).status, 404, "another project's token");
  assert.equal((await preview(b.project.id, a.token)).status, 404, "token used across workspaces");
  assert.equal((await preview("no-such-project", a.token)).status, 404, "unknown project");
  assert.equal((await fetch(`${base}/preview/sites/${a.project.id}?token=short`)).status, 401, "malformed token");
});
