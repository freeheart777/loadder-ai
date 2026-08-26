import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../src/App.tsx");
const page = read("../../src/pages/WebsiteContextBuilderPage.tsx");
const website = read("../../src/pages/WebsiteBuilderPage.tsx");
const contextService = read("../app/services/business-context-service.mjs");

test("website creation enters through the Business Context-first screen", () => {
  assert.match(app, /path="\\/dashboard\\/websites\\/new" element=\{<WebsiteContextBuilderPage \/>\}/);
  assert.match(app, /path="\\/dashboard\\/websites\\/:id\\/edit" element=\{<WebsiteBuilderPage \/>\}/);
  assert.match(page, /\/api\/business-context\//);
  assert.match(page, /Business Context فعال/);
});

test("the builder consumes the existing context snapshot instead of creating a second business model", () => {
  assert.match(page, /snapshot\?\.strategy\?\.valueProposition/);
  assert.match(page, /snapshot\?\.audiences\?\.targetAudiences/);
  assert.match(page, /snapshot\?\.visual\?\.direction/);
  assert.match(page, /businessContextVersionId: context\.id/);
  assert.match(contextService, /assembleBusinessContext\(sources\)/);
  assert.doesNotMatch(page, /\/api\/business-profile/);
  assert.doesNotMatch(page, /\/api\/business-dna/);
});

test("website creation never fabricates a CTA destination", () => {
  assert.match(page, /validHttps\(ctaTarget\)/);
  assert.match(page, /برای دکمه اقدام، یک نشانی HTTPS واقعی وارد کنید/);
  assert.match(page, /snapshot\?\.identity\?\.website/);
  assert.doesNotMatch(page, /wa\.me\/989120000000/);
});

test("controlled launch boundaries stay intact", () => {
  for (const forbidden of ["Commerce", "Ads", "Domains", "automation", "internal", "publish"]) {
    assert.equal(page.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

test("existing Website Builder remains the editing surface", () => {
  assert.match(app, /WebsiteBuilderPage = lazy/);
  assert.match(app, /path="\\/dashboard\\/websites\\/:id\\/edit" element=\{<WebsiteBuilderPage \/>\}/);
  assert.match(website, /visual-recommendation/);
  assert.match(website, /createBlueprint/);
});
