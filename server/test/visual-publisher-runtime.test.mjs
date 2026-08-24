import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyApiRequest, createApiProductGate } from "../app/middleware/product-gating.mjs";
import { createProductPolicy } from "../app/product-policy.mjs";
import { createVisualComponentRegistry, nativeVisualPilotManifest, safeCssDecorativeManifest, visualComponentRegistry } from "../app/visual-components/visual-component-registry.mjs";
import {
  createVisualPublicationDescriptor, renderStaticVisualPublication, validatePinnedVisualDescriptor, validateVisualPublicationPage,
  visualPublishingCompatibility, VisualPublicationError, VISUAL_PUBLISHER_CONTRACT_VERSION, VISUAL_PUBLISHER_RUNTIME_V1,
} from "../app/visual-publishing/visual-publisher-contract.mjs";

const clone = value => structuredClone(value);
const descriptor = (input = {}, options) => createVisualPublicationDescriptor({ componentId: "LOADDER_STATIC_DOT_FIELD", componentVersion: 1, props: {}, assetRefs: [], ...input }, options);
const expectCode = (fn, code) => assert.throws(fn, error => error instanceof VisualPublicationError && error.code === code);
const sha = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("Visual Publisher Runtime Contract v1", async t => {
  await t.test("contract is versioned, static-only, zero-canvas, and remote-code closed", () => {
    assert.equal(VISUAL_PUBLISHER_CONTRACT_VERSION, "VISUAL_PUBLISHER_RUNTIME_V1");
    assert.deepEqual(VISUAL_PUBLISHER_RUNTIME_V1.supportedRuntimeTiers, ["STATIC"]);
    assert.deepEqual(VISUAL_PUBLISHER_RUNTIME_V1.blockedRuntimeTiers, ["LIGHT", "INTERACTIVE", "GPU_HEAVY"]);
    assert.equal(VISUAL_PUBLISHER_RUNTIME_V1.remoteCodeAllowed, false);
    assert.equal(VISUAL_PUBLISHER_RUNTIME_V1.webglAllowed, false);
    assert.equal(VISUAL_PUBLISHER_RUNTIME_V1.pageBudget.maxCanvasCount, 0);
  });

  await t.test("safe static control produces an exact server-authoritative descriptor", () => {
    const value = descriptor();
    assert.equal(value.componentId, "LOADDER_STATIC_DOT_FIELD");
    assert.equal(value.runtimeTier, "STATIC");
    assert.equal(value.publisherContractVersion, VISUAL_PUBLISHER_CONTRACT_VERSION);
    assert.equal(value.manifestFingerprint, visualComponentRegistry.get("LOADDER_STATIC_DOT_FIELD", 1).fingerprint);
    assert.ok(value.restrictions.includes("DECORATIVE_ONLY"));
  });

  await t.test("static publication is deterministic and emits no runtime script", () => {
    const value = descriptor(), first = renderStaticVisualPublication([value]), second = renderStaticVisualPublication([value]);
    assert.deepEqual(first, second);
    assert.equal(first.checksum.length, 64);
    assert.match(first.markup, /aria-hidden="true"/);
    assert.match(first.csp, /script-src 'none'/);
    assert.doesNotMatch(first.markup + first.css, /<script|onload=|onclick=|https?:\/\//);
  });

  await t.test("native WebGL pilot remains blocked without ownership exception", () => {
    expectCode(() => createVisualPublicationDescriptor({ componentId: "LOADDER_DOT_MATRIX", componentVersion: 1, props: {}, assetRefs: [] }), "VISUAL_COMPONENT_PILOT_ONLY");
    assert.equal(visualPublishingCompatibility("LOADDER_DOT_MATRIX", 1).state, "PUBLISH_BLOCKED");
  });

  await t.test("unknown component and exact-version misses fail closed", () => {
    expectCode(() => createVisualPublicationDescriptor({ componentId: "UNKNOWN_COMPONENT", componentVersion: 1, props: {}, assetRefs: [] }), "VISUAL_COMPONENT_NOT_FOUND");
    expectCode(() => createVisualPublicationDescriptor({ componentId: "LOADDER_STATIC_DOT_FIELD", componentVersion: 2, props: {}, assetRefs: [] }), "VISUAL_COMPONENT_NOT_FOUND");
  });

  await t.test("fingerprint, manifest, policy, and publisher contract drift fail closed", () => {
    const base = descriptor();
    for (const patch of [{ manifestFingerprint: "0".repeat(64) }, { manifestVersion: "OTHER" }, { admissionPolicyVersion: "OTHER" }]) {
      expectCode(() => validatePinnedVisualDescriptor({ ...base, ...patch }), "VISUAL_MANIFEST_FINGERPRINT_MISMATCH");
    }
    expectCode(() => validatePinnedVisualDescriptor({ ...base, publisherContractVersion: "OTHER" }), "VISUAL_PUBLISHER_CONTRACT_MISMATCH");
  });

  await t.test("client authority fields and descriptor mutations are rejected", () => {
    for (const key of ["admissionState", "manifestFingerprint", "runtimeTier", "publisherCompatibility", "csp", "restrictions"]) {
      expectCode(() => createVisualPublicationDescriptor({ componentId: "LOADDER_STATIC_DOT_FIELD", componentVersion: 1, props: {}, assetRefs: [], [key]: "FORGED" }), "VISUAL_PROPS_INVALID");
    }
    expectCode(() => validatePinnedVisualDescriptor({ ...descriptor(), restrictions: [] }), "VISUAL_RESTRICTION_VIOLATION");
  });

  await t.test("props are revalidated against bounded server manifest", () => {
    const manifest = { ...clone(safeCssDecorativeManifest), propsSchema: { density: { type: "boundedNumber", minimum: 1, maximum: 4 }, tone: { type: "enum", values: ["CALM", "VIVID"] } } };
    const registry = createVisualComponentRegistry([manifest]);
    assert.equal(descriptor({ props: { density: 2, tone: "CALM" } }, { registry }).props.density, 2);
    for (const props of [{ density: 9 }, { density: 2, tone: "RAW" }, { rawHtml: "<b>x</b>" }]) expectCode(() => descriptor({ props }, { registry }), "VISUAL_PROPS_INVALID");
  });

  await t.test("asset policy permits bounded local identities and rejects arbitrary URLs", () => {
    const manifest = { ...clone(safeCssDecorativeManifest), assetPolicy: "LOADDER_HOSTED" };
    const registry = createVisualComponentRegistry([manifest]);
    assert.deepEqual(descriptor({ assetRefs: ["asset_approved_1"] }, { registry }).assetRefs, ["asset_approved_1"]);
    expectCode(() => descriptor({ assetRefs: ["https://evil.example/a.png"] }, { registry }), "VISUAL_ASSET_POLICY_UNSUPPORTED");
    expectCode(() => descriptor({ assetRefs: ["asset"] }), "VISUAL_ASSET_POLICY_UNSUPPORTED");
  });

  await t.test("remote assets, remote code, rejected admission, and prohibited licensing cannot publish", () => {
    const cases = [
      { ...clone(safeCssDecorativeManifest), assetPolicy: "REMOTE_UNREVIEWED" },
      { ...clone(safeCssDecorativeManifest), securityPosture: { ...clone(safeCssDecorativeManifest.securityPosture), remoteCode: true } },
      { ...clone(safeCssDecorativeManifest), licenseMetadata: { codeLicense: "PROHIBITED", assetLicense: "NOT_APPLICABLE", fontLicense: "NOT_APPLICABLE" } },
    ];
    for (const manifest of cases) {
      const registry = createVisualComponentRegistry([manifest]);
      expectCode(() => descriptor({}, { registry }), "VISUAL_COMPONENT_NOT_ADMITTED");
    }
  });

  await t.test("LIGHT is explicitly blocked pending immutable runtime delivery", () => {
    const manifest = { ...clone(safeCssDecorativeManifest), runtimeTier: "LIGHT", motionPolicy: "REDUCED_MOTION_STATIC", fallbackPolicy: "CSS", editorCompatibility: "LIVE_SAFE" };
    const registry = createVisualComponentRegistry([manifest]);
    assert.equal(registry.get(manifest.componentId, 1).admission.state, "ADMITTED_WITH_RESTRICTIONS");
    expectCode(() => descriptor({}, { registry }), "VISUAL_LIGHT_RUNTIME_UNAVAILABLE");
  });

  await t.test("INTERACTIVE and GPU_HEAVY remain blocked even with otherwise strong evidence", () => {
    for (const runtimeTier of ["INTERACTIVE", "GPU_HEAVY"]) {
      const manifest = { ...clone(nativeVisualPilotManifest), runtimeTier, publishingCompatibility: "COMPATIBLE", evidence: { ...clone(nativeVisualPilotManifest.evidence), quality: "STRONG", browserProfiled: true, crossBrowserSoak: true, contextLossBrowserTested: true } };
      const registry = createVisualComponentRegistry([manifest]);
      expectCode(() => createVisualPublicationDescriptor({ componentId: manifest.componentId, componentVersion: 1, props: {}, assetRefs: [] }, { registry }), runtimeTier === "GPU_HEAVY" ? "VISUAL_COMPONENT_PILOT_ONLY" : "VISUAL_RUNTIME_TIER_UNSUPPORTED");
    }
  });

  await t.test("page budget and MAX_ONE_PER_PAGE restriction are enforced per page", () => {
    const one = descriptor();
    expectCode(() => validateVisualPublicationPage([one, one]), "VISUAL_RESTRICTION_VIOLATION");
    expectCode(() => validateVisualPublicationPage([one, one, one, one, one]), "VISUAL_PAGE_BUDGET_EXCEEDED");
    assert.equal(validateVisualPublicationPage([one]).length, 1);
  });

  await t.test("descriptor configuration and asset identity participate in checksum", () => {
    const propsManifest = { ...clone(safeCssDecorativeManifest), propsSchema: { tone: { type: "enum", values: ["CALM", "VIVID"] } }, instanceBudget: { maxInstancesPerPage: 2 }, accessibilityPolicy: "SEMANTIC_SUPPORTED", seoPolicy: "SEMANTIC_DOM_PRESERVED", editorCompatibility: "LIVE_SAFE" };
    const propsRegistry = createVisualComponentRegistry([propsManifest]);
    const calm = renderStaticVisualPublication([descriptor({ props: { tone: "CALM" } }, { registry: propsRegistry })], { registry: propsRegistry });
    const vivid = renderStaticVisualPublication([descriptor({ props: { tone: "VIVID" } }, { registry: propsRegistry })], { registry: propsRegistry });
    assert.notEqual(calm.checksum, vivid.checksum);
    const assetManifest = { ...propsManifest, propsSchema: {}, assetPolicy: "LOADDER_HOSTED" };
    const assetRegistry = createVisualComponentRegistry([assetManifest]);
    const a = renderStaticVisualPublication([descriptor({ assetRefs: ["asset_a"] }, { registry: assetRegistry })], { registry: assetRegistry });
    const b = renderStaticVisualPublication([descriptor({ assetRefs: ["asset_b"] }, { registry: assetRegistry })], { registry: assetRegistry });
    assert.notEqual(a.checksum, b.checksum);
  });

  await t.test("registry drift cannot silently re-render pinned descriptor", () => {
    const pinned = descriptor();
    const changedManifest = { ...clone(safeCssDecorativeManifest), displayName: "Changed implementation identity" };
    const changedRegistry = createVisualComponentRegistry([changedManifest]);
    expectCode(() => validatePinnedVisualDescriptor(pinned, { registry: changedRegistry }), "VISUAL_MANIFEST_FINGERPRINT_MISMATCH");
  });

  await t.test("version/config canonicalization remains reproducible", () => {
    const value = descriptor();
    assert.equal(sha(value), sha(structuredClone(value)));
    assert.notEqual(sha(value), sha({ ...value, componentVersion: 2 }));
  });

  await t.test("CSP does not expand to remote or executable visual runtime", () => {
    const { csp } = renderStaticVisualPublication([descriptor()]);
    assert.match(csp, /script-src 'none'/);
    assert.match(csp, /connect-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-eval|https:|http:|\*/);
  });

  await t.test("internal compatibility API is read-only and ordinary customers are denied", () => {
    assert.deepEqual(classifyApiRequest("GET", "/api/internal/visual-publishing/contract"), { feature: "development_tools", internal: true });
    assert.deepEqual(classifyApiRequest("GET", "/api/internal/visual-publishing/compatibility/LOADDER_STATIC_DOT_FIELD/1"), { feature: "development_tools", internal: true });
    const gate = createApiProductGate(createProductPolicy({ nodeEnv: "production" }));
    let status = 0;
    gate({ method: "GET", path: "/api/internal/visual-publishing/contract", internalAccess: false }, { status(value) { status = value; return this; }, json() { return this; } }, () => assert.fail("customer bypassed internal gate"));
    assert.equal(status, 403);
    const source = readFileSync(new URL("../app/routes/internal-visual-publishing.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(source, /\.post\(|\.put\(|\.patch\(|\.delete\(/);
  });

  await t.test("contract has no Builder, publisher, persistence, AI, or remote-runtime coupling", () => {
    const source = readFileSync(new URL("../app/visual-publishing/visual-publisher-contract.mjs", import.meta.url), "utf8");
    for (const forbidden of ["website-service", "website-publisher", "landing-publisher", "sqlite", "repository", "OpenAI", "fetch(", "WebGLRenderingContext", "from \"three\""]) assert.equal(source.includes(forbidden), false, forbidden);
  });
});

test("10,000 deterministic visual publication validations remain trivial", () => {
  const value = descriptor(), started = process.hrtime.bigint();
  for (let index = 0; index < 10_000; index += 1) assert.equal(validatePinnedVisualDescriptor(value).componentVersion, 1);
  const totalMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(totalMs < 2000);
});
