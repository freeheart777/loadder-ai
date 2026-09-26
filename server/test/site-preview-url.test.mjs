import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteProjectsRouter } from "../app/routes/site-projects.mjs";
import { createPublicSitesRouter } from "../app/routes/public-sites.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { parsePublicSiteBaseUrl } from "../app/config/environment.mjs";
import { previewSiteUrl } from "../app/services/public-site-urls.mjs";

// The Studio opened the private preview link at the API origin because
// preview-token returned a relative /preview/sites/... path; only the
// public-site runtime serves that path, so the link was a 404.
test("previewSiteUrl builds an absolute URL on the public-site base", () => {
  assert.equal(previewSiteUrl("http://127.0.0.1:3002/", "p 1", "t/k"), "http://127.0.0.1:3002/preview/sites/p%201?token=t%2Fk");
  assert.equal(previewSiteUrl("", "p", "t"), null);
});

test("PUBLIC_SITE_BASE_URL is validated and normalised", () => {
  assert.equal(parsePublicSiteBaseUrl("", "http://127.0.0.1:3002"), "http://127.0.0.1:3002");
  assert.equal(parsePublicSiteBaseUrl("https://sites.loadder.ir/", "x"), "https://sites.loadder.ir");
  assert.throws(() => parsePublicSiteBaseUrl("ftp://loadder.ir", "x"), /http or https/);
  assert.throws(() => parsePublicSiteBaseUrl("not a url", "x"), /absolute http\(s\) URL/);
});

test("preview-token returns a link that the public-site runtime renders", async () => {
  const repository = createSiteProjectRepository(createSiteTestDb());
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) } });
  const publicApp = express();
  publicApp.use(createPublicSitesRouter({ repository }));
  const publicServer = publicApp.listen(0, "127.0.0.1");
  await once(publicServer, "listening");
  const publicSiteBaseUrl = `http://127.0.0.1:${publicServer.address().port}`;
  const api = express();
  api.use(express.json());
  api.use((req, res, next) => runWithWorkspace("ws-1", next));
  api.use("/api", createSiteProjectsRouter({ service, publicSiteBaseUrl }));
  const apiServer = api.listen(0, "127.0.0.1");
  await once(apiServer, "listening");
  try {
    const project = runWithWorkspace("ws-1", () => service.create({ name: "کلینیک نور", siteType: "BUSINESS", content: { storeBuilderV16: { version: 16, header: { storeName: "کلینیک نور" }, sections: [{ id: "a", type: "about", enabled: true, title: "پیش‌نویس خصوصی", subtitle: "" }] } } }));
    const res = await fetch(`http://127.0.0.1:${apiServer.address().port}/api/site-projects/${project.id}/preview-token`, { method: "POST" });
    assert.equal(res.status, 201);
    const { previewUrl } = await res.json();
    assert.ok(previewUrl.startsWith(`${publicSiteBaseUrl}/preview/sites/${project.id}?token=`), `absolute link on the public base (got ${previewUrl})`);
    const page = await fetch(previewUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /پیش‌نویس خصوصی/);
  } finally {
    apiServer.close();
    publicServer.close();
  }
});
