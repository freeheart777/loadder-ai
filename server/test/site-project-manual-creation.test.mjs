import test from "node:test";
import assert from "node:assert/strict";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";

const fixedNow = new Date("2026-08-29T12:00:00.000Z");

function repositorySpy() {
  const calls = [];
  return {
    calls,
    repository: {
      create(input) { calls.push(input); return { id: "site-1", workspaceId: "ws-1", ...input }; },
    },
  };
}

test("manual site project can be created without Business Context", () => {
  const { calls, repository } = repositorySpy();
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: null }) }, now: () => fixedNow });

  const project = service.create({ name: "ایران افزار", siteType: "STORE", content: { generatedFrom: "MANUAL" } });

  assert.equal(project.name, "ایران افزار");
  assert.equal(project.siteType, "STORE");
  assert.equal(calls[0].contextVersionId, null);
  assert.equal(calls[0].content.generatedFrom, "MANUAL");
});

test("site project links active Business Context when available", () => {
  const { calls, repository } = repositorySpy();
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) }, now: () => fixedNow });

  service.create({ name: "Context Store", siteType: "STORE", content: { generatedFrom: "BUSINESS_CONTEXT" } });

  assert.equal(calls[0].contextVersionId, "ctx-1");
});

test("stale Business Context does not block a manual draft", () => {
  const { calls, repository } = repositorySpy();
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-old" }, isStale: true }) }, now: () => fixedNow });

  service.create({ name: "Manual Draft", siteType: "BUSINESS", content: { generatedFrom: "MANUAL" } });

  assert.equal(calls[0].contextVersionId, null);
});
