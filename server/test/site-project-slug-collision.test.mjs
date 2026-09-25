import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteProjectsRouter } from "../app/routes/site-projects.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

// The Studio names a project created from a template after the template's
// label, so creating a second website from the same template used to reuse
// the slug and fail with "UNIQUE constraint failed: site_projects.workspace_id,
// site_projects.slug" (HTTP 500).
const TEMPLATE_LABEL = "کلینیک و پزشک";
const templateDoc = { storeBuilderV16: { version: 16, header: { storeName: "کلینیک شما" }, sections: [{ id: "services-main", type: "services", enabled: true, title: "خدمات", subtitle: "" }] } };
const context = { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) };
const setup = (repositoryOverrides = {}) => {
  const repository = createSiteProjectRepository(createSiteTestDb());
  return { repository, service: createSiteProjectService({ repository: { ...repository, ...repositoryOverrides }, businessContextService: context }) };
};
const create = (service, workspace, name = TEMPLATE_LABEL) => runWithWorkspace(workspace, () => service.create({ name, siteType: "BUSINESS", content: templateDoc }));

test("first project from a template keeps the plain slug", () => {
  const { service } = setup();
  assert.equal(create(service, "ws-1").slug, "کلینیک-و-پزشک");
});

test("a second and third project with the same template/name get unique slugs in the same workspace", () => {
  const { service } = setup();
  const first = create(service, "ws-1");
  const second = create(service, "ws-1");
  const third = create(service, "ws-1");
  assert.equal(first.slug, "کلینیک-و-پزشک", "the first slug is unchanged by later projects");
  for (const project of [second, third]) assert.match(project.slug, /^کلینیک-و-پزشک-[0-9a-f]{6}$/);
  assert.equal(new Set([first.slug, second.slug, third.slug]).size, 3);
  assert.equal(runWithWorkspace("ws-1", () => service.list()).length, 3);
});

test("the same name in another workspace never fails", () => {
  const { service } = setup();
  const mine = create(service, "ws-1");
  const theirs = create(service, "ws-2");
  assert.ok(theirs.id && theirs.slug);
  assert.notEqual(mine.id, theirs.id);
});

test("a slug claimed between the availability check and the insert is retried, not a 500", () => {
  // Simulate a concurrent create: the check says "free", the insert still collides once.
  let raced = false;
  const { repository, service } = setup({
    isSlugTaken: () => false,
    create(input) {
      if (!raced) { raced = true; throw new Error("UNIQUE constraint failed: site_projects.workspace_id, site_projects.slug"); }
      return repository.create(input);
    },
  });
  const project = create(service, "ws-1");
  assert.ok(raced, "the collision path was exercised");
  assert.ok(project.id);
});

test("a persistent collision is a clean 409, never a raw SQLite error", () => {
  const { service } = setup({
    isSlugTaken: () => false,
    create() { throw new Error("UNIQUE constraint failed: site_projects.workspace_id, site_projects.slug"); },
  });
  assert.throws(() => create(service, "ws-1"), (error) => error.status === 409 && error.code === "SITE_SLUG_UNAVAILABLE");
});

test("other create errors are not swallowed by the slug retry", () => {
  const { service } = setup({ create() { throw new Error("disk I/O error"); } });
  assert.throws(() => create(service, "ws-1"), /disk I\/O error/);
});

test("renaming a slug onto another project's slug is a 409, and existing slugs are untouched", () => {
  const { service } = setup();
  const a = create(service, "ws-1", "Clinic A");
  const b = create(service, "ws-1", "Clinic B");
  runWithWorkspace("ws-1", () => {
    assert.throws(() => service.update(b.id, { slug: a.slug }), (error) => error.status === 409 && error.code === "SITE_SLUG_TAKEN");
    assert.equal(service.get(a.id).slug, "clinic-a");
    assert.equal(service.get(b.id).slug, "clinic-b");
    assert.equal(service.update(b.id, { slug: "clinic-b" }).slug, "clinic-b", "re-saving its own slug is fine");
  });
});

test("HTTP: template selection → create twice → both 201", async () => {
  const { service } = setup();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => runWithWorkspace("ws-1", next));
  app.use("/api", createSiteProjectsRouter({ service }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/site-projects`;
    const post = () => fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: TEMPLATE_LABEL, siteType: "BUSINESS", content: templateDoc }) });
    const [first, second] = [await post(), await post()];
    assert.equal(first.status, 201);
    assert.equal(second.status, 201, "the second website from the same template is created, not a 500");
    const [a, b] = [(await first.json()).project, (await second.json()).project];
    assert.notEqual(a.slug, b.slug);
  } finally {
    server.close();
  }
});
