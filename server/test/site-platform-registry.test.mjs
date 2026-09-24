import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createRegistry, defineCapability, defineSection } from "../app/site-platform/registry.mjs";
import { INITIAL_CAPABILITIES, siteRegistry } from "../app/site-platform/capabilities.mjs";
import { resolveCapabilities } from "../app/site-platform/capability-resolver.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const code = (fn, expected) => assert.throws(fn, (error) => error.code === expected);

const cap = (key, extra = {}) => defineCapability({ key, label: key, ...extra });

// --- definitions -----------------------------------------------------------

test("invalid section names are rejected", () => {
  for (const type of ["hero", "Core.hero", "core.", ".hero", "core.hero.big", "core.hero-banner", "", null]) {
    code(() => defineSection({ type, capability: "core", label: "x" }), "INVALID_SECTION_TYPE");
  }
  code(() => defineSection({ type: "commerce.hero", capability: "core", label: "x" }), "SECTION_NAMESPACE_MISMATCH");
  code(() => cap("core", { sections: [{ type: "commerce.hero", label: "x" }] }), "SECTION_NAMESPACE_MISMATCH");
  code(() => defineSection({ type: "core.hero", capability: "core", label: "x", aliases: ["core.banner"] }), "INVALID_ALIAS");
});

test("definitions are validated and frozen", () => {
  const section = defineSection({ type: "core.hero", capability: "core", label: "Hero" });
  assert.deepEqual(section.variants, ["default"]);
  assert.equal(section.interactive, false);
  assert.equal(section.seo, null);
  assert.ok(Object.isFrozen(section) && Object.isFrozen(section.aliases));
  code(() => defineSection({ type: "core.hero", capability: "core" }), "INVALID_DEFINITION");
  code(() => cap("core", { status: "beta" }), "INVALID_DEFINITION");
  code(() => cap("Core"), "INVALID_CAPABILITY_KEY");
  assert.equal(cap("forms", { sections: [{ type: "forms.contactForm", label: "c", interactive: true }] }).interactive, true, "an interactive section makes its capability interactive");
});

// --- registry construction -------------------------------------------------

test("duplicate sections and aliases are rejected", () => {
  const a = cap("core", { sections: [{ type: "core.hero", label: "h", aliases: ["hero"] }] });
  const b = cap("blog", { sections: [{ type: "blog.hero", label: "h", aliases: ["hero"] }] });
  code(() => createRegistry([a, b]), "DUPLICATE_SECTION");
  code(() => createRegistry([cap("core", { sections: [{ type: "core.hero", label: "h" }, { type: "core.hero", label: "h" }] })]), "DUPLICATE_SECTION");
  code(() => createRegistry([a, a]), "DUPLICATE_CAPABILITY");
});

test("a missing dependency capability is rejected", () => {
  code(() => createRegistry([cap("commerce", { dependencies: ["payments"] })]), "MISSING_CAPABILITY");
});

test("circular dependencies are detected", () => {
  code(() => cap("a", { dependencies: ["a"] }), "CIRCULAR_DEPENDENCY");
  code(() => createRegistry([cap("a", { dependencies: ["b"] }), cap("b", { dependencies: ["c"] }), cap("c", { dependencies: ["a"] })]), "CIRCULAR_DEPENDENCY");
});

test("only defineCapability() results are accepted", () => {
  code(() => createRegistry([{ key: "core", label: "core", dependencies: [], sections: [], status: "active" }]), "INVALID_DEFINITION");
});

test("dependency expansion is transitive, ordered and drops unknown keys", () => {
  const registry = createRegistry([cap("a", { dependencies: ["b"] }), cap("b", { dependencies: ["c"] }), cap("c"), cap("d")]);
  assert.deepEqual(registry.expand(["a"]), ["a", "b", "c"]);
  assert.deepEqual(registry.expand(["d", "unknown", "d"]), ["d"]);
  assert.deepEqual(registry.expand([]), []);
});

test("pending capabilities contribute no sections", () => {
  const registry = createRegistry([cap("booking", { status: "pending", sections: [{ type: "booking.calendar", label: "c", interactive: true }] })]);
  assert.deepEqual(registry.sectionsFor(["booking"]), []);
  assert.equal(registry.capabilityOf("booking.calendar"), "booking", "still recognized");
  assert.deepEqual(registry.selectableCapabilities(), []);
});

// --- initial site registry ---------------------------------------------------

test("commerce expands to payments; payments is internal and not selectable", () => {
  assert.deepEqual(siteRegistry.expand(["commerce"]), ["payments", "commerce"]);
  assert.equal(siteRegistry.getCapability("payments").status, "internal");
  assert.ok(!siteRegistry.selectableCapabilities().includes("payments"));
  assert.ok(siteRegistry.selectableCapabilities().includes("commerce"));
  assert.deepEqual(siteRegistry.sectionsFor(["payments"]), [], "payments provides no sections");
});

test("legacy aliases resolve to namespaced types", () => {
  const expected = {
    products: "commerce.productShelf", about: "core.about", services: "core.services", team: "people.profileGrid",
    portfolio: "core.portfolio", "text-image": "core.textImage", cta: "core.cta", contact: "core.contact",
    text: "core.richText", spacer: "core.spacer", banner: "core.bannerGroup", trust: "core.trust",
    "category-grid": "core.categoryGrid", brand: "core.logoWall",
  };
  for (const [legacy, type] of Object.entries(expected)) {
    assert.equal(siteRegistry.resolveSectionType(legacy), type, legacy);
    assert.equal(siteRegistry.resolveSectionType(type), type, `${type} resolves to itself`);
  }
  assert.equal(siteRegistry.capabilityOf("products"), "commerce");
  assert.equal(siteRegistry.capabilityOf("team"), "people");
  assert.equal(siteRegistry.capabilityOf("about"), "core");
  for (const unknown of ["hero-v9", "core.unknown", "", null, undefined, 1]) {
    assert.equal(siteRegistry.resolveSectionType(unknown), null);
    assert.equal(siteRegistry.capabilityOf(unknown), null);
  }
});

test("sectionsFor ignores capabilities the registry does not know yet", () => {
  const types = siteRegistry.sectionsFor(["core", "forms", "blog"]).map((section) => section.type);
  assert.ok(types.includes("core.about"));
  assert.ok(!types.some((type) => !type.startsWith("core.")));
});

// --- agreement with the current implementation ------------------------------

const quotedList = (text) => [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const siteTypes = source("src/components/store-studio-v16/site-types.ts");
const frontendSectionTypes = (kind) => quotedList(siteTypes.match(new RegExp(`${kind}:\\s*\\{[\\s\\S]*?sectionTypes:\\s*\\[([^\\]]*)\\]`))[1]);
const sectionConfigUnion = quotedList(source("src/components/store-studio-v16/types.ts").match(/export type SectionConfig = \{[^}]*?type:\s*([^;]+);/)[1]);
const corporateTypes = quotedList(source("server/app/services/corporate-site-html.mjs").match(/CORPORATE_TYPES = new Set\(\[([^\]]*)\]\)/)[1]);
const storeRendererTypes = quotedList([...source("server/app/services/store-site-html.mjs").matchAll(/section\.type === "[^"]+"/g)].join(" "));

test("agreement: every existing section type has registry metadata", () => {
  assert.ok(sectionConfigUnion.length >= 14, "SectionConfig union was parsed");
  assert.ok(corporateTypes.length >= 7 && storeRendererTypes.length >= 6, "renderer section types were parsed");
  for (const type of new Set([...sectionConfigUnion, ...corporateTypes, ...storeRendererTypes])) {
    assert.ok(siteRegistry.resolveSectionType(type), `existing section type "${type}" is registered`);
  }
});

test("agreement: STORE and BUSINESS section lists fit their resolved capabilities", () => {
  for (const kind of ["STORE", "BUSINESS"]) {
    const types = frontendSectionTypes(kind);
    assert.ok(types.length > 0, `${kind} sectionTypes parsed`);
    const { capabilities } = resolveCapabilities({ siteType: kind }, {});
    const available = new Set(siteRegistry.sectionsFor(capabilities).map((section) => section.type));
    for (const type of types) assert.ok(available.has(siteRegistry.resolveSectionType(type)), `${kind} allows ${type}`);
  }
});

test("agreement: no corporate section belongs to commerce", () => {
  for (const type of [...frontendSectionTypes("BUSINESS"), ...corporateTypes]) {
    assert.notEqual(siteRegistry.capabilityOf(type), "commerce", type);
  }
});

test("agreement: the registry does not replace renderers yet", () => {
  // Renderers stay unaware of capabilities.
  for (const file of ["server/app/services/corporate-site-html.mjs", "server/app/services/store-site-html.mjs", "server/app/services/store-public-presentation.mjs", "server/public-site-server.mjs"]) {
    assert.doesNotMatch(source(file), /site-platform\//, `${file} must not import site-platform`);
  }
  // Since PR 3 the public routers may use the runtime capability context, and nothing else from site-platform.
  for (const file of ["server/app/routes/public-sites.mjs", "server/app/routes/auth.mjs"]) {
    const imports = [...source(file).matchAll(/from\s+"([^"]*site-platform\/[^"]*)"/g)].map((match) => match[1]);
    assert.deepEqual(imports, ["../site-platform/runtime-capabilities.mjs"], `${file} imports only the runtime capability context`);
  }
  assert.doesNotMatch(source("server/app/site-platform/runtime-capabilities.mjs"), /from\s+"[^"]*(site-html|ecommerce|commerce\/|capabilities\.mjs|registry\.mjs)/, "runtime context imports only the resolver and manifest reader");
  for (const capability of INITIAL_CAPABILITIES) {
    for (const section of capability.sections) assert.equal(section.render, undefined, `${section.type} carries metadata only`);
  }
});
