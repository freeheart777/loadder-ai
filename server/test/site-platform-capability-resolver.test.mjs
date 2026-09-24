import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_CAPABILITY_MAP, PENDING_CAPABILITIES, SUPPORTED_CAPABILITIES, resolveCapabilities,
} from "../app/site-platform/capability-resolver.mjs";
import { ensureWebsitePlatformContent } from "../app/services/website-platform-definition.mjs";

const SITE_TYPES = ["STORE", "BUSINESS", "MEDICAL", "LEGAL", "NEWS", "UNKNOWN", undefined];
// The content a site project actually stores after creation.
const created = (siteType) => ensureWebsitePlatformContent({}, { siteType, name: "نمونه" });

test("STORE resolves core + commerce + payments + forms", () => {
  assert.deepEqual(resolveCapabilities({ siteType: "STORE" }, created("STORE")), {
    capabilities: ["core", "commerce", "payments", "forms"], unregistered: [], ignored: ["ads", "analytics"], source: "document",
  });
});

test("BUSINESS resolves core + forms + blog + people and never commerce", () => {
  assert.deepEqual(resolveCapabilities({ siteType: "BUSINESS" }, created("BUSINESS")), {
    capabilities: ["core", "forms", "blog", "people"], unregistered: [], ignored: ["ads", "analytics"], source: "document",
  });
});

test("MEDICAL recognizes booking as unregistered", () => {
  assert.deepEqual(resolveCapabilities({ siteType: "MEDICAL" }, created("MEDICAL")), {
    capabilities: ["core", "forms", "blog"], unregistered: ["booking"], ignored: ["ads", "analytics"], source: "document",
  });
});

test("LEGAL recognizes booking as unregistered and keeps people", () => {
  assert.deepEqual(resolveCapabilities({ siteType: "LEGAL" }, created("LEGAL")), {
    capabilities: ["core", "forms", "blog", "people"], unregistered: ["booking"], ignored: ["ads", "analytics"], source: "document",
  });
});

test("legacy names map to canonical capabilities", () => {
  const { capabilities } = resolveCapabilities({ siteType: "BUSINESS" }, { websitePlatform: { capabilities: ["lead", "team", "content", "landing", "location", "portfolio"] } });
  assert.deepEqual(capabilities, ["core", "forms", "blog", "people"]);
  assert.equal(LEGACY_CAPABILITY_MAP.catalog, "commerce");
  assert.equal(LEGACY_CAPABILITY_MAP.lead, "forms");
  assert.equal(LEGACY_CAPABILITY_MAP.team, "people");
  assert.equal(LEGACY_CAPABILITY_MAP.content, "blog");
});

test("compatibility: commerce and payments present if and only if siteType is STORE", () => {
  for (const siteType of SITE_TYPES) {
    const variants = [
      resolveCapabilities({ siteType }, created(siteType)),
      resolveCapabilities({ siteType }, {}),
      resolveCapabilities({ siteType }, { websitePlatform: { capabilities: ["commerce", "catalog", "payments"] } }),
      resolveCapabilities({ siteType }, { websitePlatform: { capabilities: [] } }),
    ];
    for (const { capabilities } of variants) {
      const expected = siteType === "STORE";
      assert.equal(capabilities.includes("commerce"), expected, `${siteType} commerce`);
      assert.equal(capabilities.includes("payments"), expected, `${siteType} payments`);
    }
  }
});

test("siteType matching is case-insensitive, as in the renderers", () => {
  assert.ok(resolveCapabilities({ siteType: "store" }, {}).capabilities.includes("commerce"));
});

test("stored capabilities win over archetype defaults", () => {
  const result = resolveCapabilities({ siteType: "BUSINESS" }, { websitePlatform: { capabilities: ["blog"] } });
  assert.deepEqual(result.capabilities, ["core", "blog"]);
  assert.equal(result.source, "document");
});

test("courses is recognized but unregistered until its phase ships", () => {
  const result = resolveCapabilities({ siteType: "BUSINESS" }, { websitePlatform: { capabilities: ["courses", "booking"] } });
  assert.deepEqual(result.capabilities, ["core"]);
  assert.deepEqual(result.unregistered, ["booking", "courses"]);
});

test("missing or malformed content falls back to archetype defaults", () => {
  for (const content of [undefined, null, {}, { websitePlatform: null }, { websitePlatform: { capabilities: "commerce" } }]) {
    const result = resolveCapabilities({ siteType: "BUSINESS" }, content);
    assert.equal(result.source, "archetype");
    assert.deepEqual(result.capabilities, ["core", "forms", "blog", "people"]);
  }
  assert.deepEqual(resolveCapabilities(null).capabilities, ["core", "forms"], "no project resolves as a custom site");
});

test("content defaults to project.content", () => {
  const project = { siteType: "LEGAL", content: created("LEGAL") };
  assert.deepEqual(resolveCapabilities(project), resolveCapabilities(project, project.content));
});

test("core is always present; output is ordered, unique and canonical", () => {
  const result = resolveCapabilities({ siteType: "STORE" }, { websitePlatform: { capabilities: ["forms", "lead", " Forms ", "catalog", "commerce", null, 42, "", "booking"] } });
  assert.deepEqual(result.capabilities, ["core", "commerce", "payments", "forms"]);
  assert.deepEqual(result.unregistered, ["booking"]);
  assert.deepEqual(result.ignored, [], "non-string and empty entries are skipped");
  for (const name of [...result.capabilities, ...result.unregistered]) assert.ok(SUPPORTED_CAPABILITIES.includes(name));
});

test("unknown names and integrations are ignored, never thrown", () => {
  const result = resolveCapabilities({ siteType: "BUSINESS" }, { websitePlatform: { capabilities: ["analytics", "ads", "teleport"] } });
  assert.deepEqual(result.capabilities, ["core"]);
  assert.deepEqual(result.ignored, ["ads", "analytics", "teleport"]);
});

test("pending capabilities are never reported as loadable", () => {
  for (const siteType of SITE_TYPES) {
    const { capabilities } = resolveCapabilities({ siteType }, { websitePlatform: { capabilities: [...SUPPORTED_CAPABILITIES] } });
    for (const pending of PENDING_CAPABILITIES) assert.ok(!capabilities.includes(pending));
  }
});

test("the resolver never mutates its input", () => {
  const content = created("STORE");
  const before = structuredClone(content);
  resolveCapabilities({ siteType: "STORE" }, content);
  assert.deepEqual(content, before);
});
