import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyApiRequest, createApiProductGate } from "../app/middleware/product-gating.mjs";
import { createProductPolicy } from "../app/product-policy.mjs";
import {
  evaluateVisualManifest, fingerprintVisualManifest, validateVisualManifest,
  VISUAL_ADMISSION_POLICY_VERSION, VISUAL_ADMISSION_STATES, VISUAL_REASON_CODES, VISUAL_RUNTIME_TIERS,
  visualProviderRegistry,
} from "../app/visual-components/visual-component-policy.mjs";
import { createVisualComponentRegistry, nativeVisualPilotManifest, safeCssDecorativeManifest, visualComponentRegistry } from "../app/visual-components/visual-component-registry.mjs";

const clone = value => structuredClone(value);
const changed = (base, patch) => Object.assign(clone(base), patch);
const evaluate = patch => evaluateVisualManifest(changed(nativeVisualPilotManifest, patch));

test("Visual Component Admission Policy v1", async t => {
  await t.test("policy, providers, states, tiers, and reason codes are bounded and versioned", () => {
    assert.equal(VISUAL_ADMISSION_POLICY_VERSION, "VISUAL_COMPONENT_ADMISSION_V1");
    assert.deepEqual(VISUAL_RUNTIME_TIERS, ["STATIC", "LIGHT", "INTERACTIVE", "GPU_HEAVY"]);
    assert.equal(new Set(VISUAL_ADMISSION_STATES).size, 5);
    assert.deepEqual(visualProviderRegistry.map(x => x.id), ["LOADDER_NATIVE", "THREEUI_SELECTED", "OTHER_REVIEWED_PROVIDER"]);
    assert.ok(VISUAL_REASON_CODES.includes("TRADEOFF_DETECTED"));
    assert.ok(visualProviderRegistry.every(x => x.remoteCodeAllowed === false));
  });

  await t.test("native interactive pilot is honestly PILOT_ONLY", () => {
    const result = evaluateVisualManifest(nativeVisualPilotManifest);
    assert.equal(result.state, "PILOT_ONLY");
    assert.equal(result.evaluatedAtPolicyVersion, VISUAL_ADMISSION_POLICY_VERSION);
    assert.ok(result.reasonCodes.includes("PUBLISHING_INCOMPATIBLE"));
    assert.ok(result.missingEvidence.includes("EVIDENCE_INSUFFICIENT"));
    assert.ok(result.restrictions.includes("STATIC_ON_MOBILE"));
  });

  await t.test("safe CSS fixture passes with bounded restrictions", () => {
    const result = evaluateVisualManifest(safeCssDecorativeManifest);
    assert.equal(result.state, "ADMITTED_WITH_RESTRICTIONS");
    assert.deepEqual(result.criticalFailures, []);
    assert.ok(result.restrictions.includes("DECORATIVE_ONLY"));
  });

  await t.test("policy can produce fully ADMITTED without becoming approve-all", () => {
    const manifest = changed(safeCssDecorativeManifest, { componentId: "LOADDER_SEMANTIC_STATIC", accessibilityPolicy: "SEMANTIC_SUPPORTED", seoPolicy: "SEMANTIC_DOM_PRESERVED", instanceBudget: { maxInstancesPerPage: 2 }, editorCompatibility: "LIVE_SAFE" });
    assert.equal(evaluateVisualManifest(manifest).state, "ADMITTED");
  });

  await t.test("strict manifest rejects unknown fields, functions, raw code props, and invalid bounds", () => {
    assert.equal(validateVisualManifest({ ...clone(safeCssDecorativeManifest), admissionState: "ADMITTED" }).valid, false);
    assert.equal(validateVisualManifest({ ...clone(safeCssDecorativeManifest), evil: () => true }).valid, false);
    for (const definition of [{ type: "rawHtml" }, { type: "javascript" }, { type: "boundedNumber", minimum: 2, maximum: 1 }]) {
      const manifest = changed(safeCssDecorativeManifest, { propsSchema: { payload: definition } });
      assert.equal(evaluateVisualManifest(manifest).state, "REJECTED");
    }
  });

  await t.test("remote code, iframe, unsafe HTML, shader input, and untrusted URLs are hard vetoes", () => {
    for (const key of ["remoteCode", "iframe", "unsafeHtml", "arbitraryShader", "untrustedUrl", "dynamicImport"]) {
      const securityPosture = { ...clone(nativeVisualPilotManifest.securityPosture), [key]: true };
      const result = evaluate({ securityPosture });
      assert.equal(result.state, "REJECTED");
      assert.ok(result.criticalFailures.includes("REMOTE_CODE_FORBIDDEN"));
    }
  });

  await t.test("unreviewed remote assets and prohibited licenses are hard vetoes", () => {
    assert.equal(evaluate({ assetPolicy: "REMOTE_UNREVIEWED" }).state, "REJECTED");
    const result = evaluate({ licenseMetadata: { codeLicense: "PROHIBITED", assetLicense: "NOT_APPLICABLE", fontLicense: "NOT_APPLICABLE" } });
    assert.equal(result.state, "REJECTED");
    assert.ok(result.criticalFailures.includes("LICENSE_PROHIBITED"));
  });

  await t.test("unverified license produces INSUFFICIENT_EVIDENCE", () => {
    const result = evaluateVisualManifest(changed(safeCssDecorativeManifest, { licenseMetadata: { codeLicense: "UNVERIFIED", assetLicense: "NOT_APPLICABLE", fontLicense: "NOT_APPLICABLE" } }));
    assert.equal(result.state, "INSUFFICIENT_EVIDENCE");
    assert.ok(result.missingEvidence.includes("LICENSE_UNVERIFIED"));
  });

  await t.test("unknown and reviewed-but-not-trusted providers fail closed", () => {
    assert.equal(evaluate({ provider: "UNKNOWN" }).state, "REJECTED");
    const selected = evaluate({ provider: "THREEUI_SELECTED" });
    assert.equal(selected.state, "REJECTED");
    assert.ok(selected.criticalFailures.includes("PROVIDER_NOT_TRUSTED"));
  });

  await t.test("dependency conflict and startup leak cannot be admitted", () => {
    const conflict = evaluate({ dependencySet: "CONFLICTING" });
    assert.equal(conflict.state, "REJECTED");
    assert.ok(conflict.criticalFailures.includes("DEPENDENCY_CONFLICT"));
    const leaked = evaluate({ publishingCompatibility: "COMPATIBLE", evidence: { ...clone(nativeVisualPilotManifest.evidence), startupDeltaBytes: 9000, browserProfiled: true, crossBrowserSoak: true, contextLossBrowserTested: true } });
    assert.equal(leaked.state, "PILOT_ONLY");
    assert.ok(leaked.reasonCodes.includes("STARTUP_BUNDLE_LEAK"));
  });

  await t.test("accessibility and SEO failures are hard vetoes", () => {
    const accessibility = evaluate({ accessibilityPolicy: "UNSAFE" });
    const seo = evaluate({ seoPolicy: "UNSAFE" });
    assert.equal(accessibility.state, "REJECTED");
    assert.ok(accessibility.criticalFailures.includes("ACCESSIBILITY_UNSAFE"));
    assert.equal(seo.state, "REJECTED");
    assert.ok(seo.criticalFailures.includes("SEO_UNSAFE"));
  });

  await t.test("GPU-heavy, fallback, mobile, and reduced-motion gates are enforced", () => {
    const gpu = evaluate({ runtimeTier: "GPU_HEAVY", mobilePolicy: "UNSUPPORTED", fallbackPolicy: "NONE", evidence: { ...clone(nativeVisualPilotManifest.evidence), mobileFallbackTested: false } });
    assert.equal(gpu.state, "REJECTED");
    assert.ok(gpu.criticalFailures.includes("STATIC_FALLBACK_REQUIRED"));
    const motion = evaluate({ motionPolicy: "MOTION_REQUIRED" });
    assert.equal(motion.state, "REJECTED");
    assert.ok(motion.criticalFailures.includes("REDUCED_MOTION_REQUIRED"));
  });

  await t.test("missing cleanup evidence and offscreen discipline prevent admission", () => {
    const cleanupPolicy = { ...clone(nativeVisualPilotManifest.cleanupPolicy), raf: false, offscreenPause: false };
    const result = evaluate({ publishingCompatibility: "COMPATIBLE", cleanupPolicy, evidence: { ...clone(nativeVisualPilotManifest.evidence), cleanupTested: false, browserProfiled: true, crossBrowserSoak: true, contextLossBrowserTested: true } });
    assert.equal(result.state, "PILOT_ONLY");
    assert.ok(result.missingEvidence.includes("CLEANUP_EVIDENCE_MISSING"));
    assert.ok(result.missingEvidence.includes("OFFSCREEN_POLICY_REQUIRED"));
  });

  await t.test("multiple canvases and unlimited instances fail closed", () => {
    const canvas = evaluate({ canvasBudget: { canvasCount: 2, contextCount: 2 } });
    assert.equal(canvas.state, "REJECTED");
    assert.ok(canvas.criticalFailures.includes("CANVAS_BUDGET_EXCEEDED"));
    assert.equal(evaluate({ instanceBudget: { maxInstancesPerPage: Number.MAX_SAFE_INTEGER } }).state, "REJECTED");
  });

  await t.test("AI and clients cannot forge admission or measured authority", () => {
    for (const key of ["admissionState", "securitySafe", "licenseSafe", "publishingSafe", "performanceSafe", "providerTrust"]) {
      assert.equal(evaluateVisualManifest({ ...clone(safeCssDecorativeManifest), [key]: true }).state, "REJECTED");
    }
    assert.equal(evaluateVisualManifest({ ...clone(safeCssDecorativeManifest), runtimeTier: "GPU_HEAVY" }).state === "ADMITTED", false);
  });

  await t.test("fingerprint is stable, canonical, version-sensitive, and timestamp-free", () => {
    const reversed = Object.fromEntries(Object.entries(clone(nativeVisualPilotManifest)).reverse());
    assert.equal(fingerprintVisualManifest(reversed), fingerprintVisualManifest(nativeVisualPilotManifest));
    assert.notEqual(fingerprintVisualManifest({ ...clone(nativeVisualPilotManifest), componentVersion: 2 }), fingerprintVisualManifest(nativeVisualPilotManifest));
    assert.equal(fingerprintVisualManifest(nativeVisualPilotManifest).length, 64);
  });

  await t.test("registry is immutable, exact-versioned, contains no ThreeUI component, and exposes no latest", () => {
    assert.equal(visualComponentRegistry.list().length, 5);
    assert.equal(visualComponentRegistry.get("LOADDER_DOT_MATRIX", 1).admission.state, "PILOT_ONLY");
    assert.equal(visualComponentRegistry.get("LOADDER_DOT_MATRIX", 2), null);
    assert.equal("latest" in visualComponentRegistry, false);
    assert.equal(visualComponentRegistry.list().some(x => x.manifest.provider !== "LOADDER_NATIVE"), false);
    assert.throws(() => createVisualComponentRegistry([safeCssDecorativeManifest, safeCssDecorativeManifest]), /VISUAL_COMPONENT_DUPLICATE/);
  });

  await t.test("internal API is read-only and ordinary access is denied by product gate", () => {
    assert.deepEqual(classifyApiRequest("GET", "/api/internal/visual-components"), { feature: "development_tools", internal: true });
    assert.deepEqual(classifyApiRequest("GET", "/api/internal/visual-components/LOADDER_DOT_MATRIX/1"), { feature: "development_tools", internal: true });
    const gate = createApiProductGate(createProductPolicy({ nodeEnv: "production" }));
    let status = 0, body;
    gate({ method: "GET", path: "/api/internal/visual-components", internalAccess: false }, { status(value) { status = value; return this; }, json(value) { body = value; return this; } }, () => assert.fail("ordinary customer bypassed internal gate"));
    assert.equal(status, 403);
    assert.equal(body.code, "FEATURE_DISABLED");
    const routeSource = readFileSync(new URL("../app/routes/internal-visual-components.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(routeSource, /\.post\(|\.put\(|\.patch\(|\.delete\(/);
  });

  await t.test("governance has no persistence, AI, remote discovery, Builder, or publisher coupling", () => {
    const files = ["../app/visual-components/visual-component-policy.mjs", "../app/visual-components/visual-component-registry.mjs", "../app/routes/internal-visual-components.mjs"];
    const source = files.map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
    for (const forbidden of ["sqlite", "repository", "OpenAI", "provider.call", "fetch(", "http://", "https://", "website-component", "landing-component", "website-publisher", "landing-publisher"]) assert.equal(source.includes(forbidden), false, forbidden);
  });
});

test("10,000 deterministic admission evaluations remain trivial", () => {
  const samples = [];
  const started = process.hrtime.bigint();
  for (let i = 0; i < 10_000; i += 1) {
    const tick = process.hrtime.bigint();
    assert.equal(evaluateVisualManifest(i % 2 ? nativeVisualPilotManifest : safeCssDecorativeManifest).componentVersion, 1);
    samples.push(Number(process.hrtime.bigint() - tick) / 1e6);
  }
  const totalMs = Number(process.hrtime.bigint() - started) / 1e6;
  const meanMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const maxMs = Math.max(...samples);
  assert.ok(totalMs < 2000);
  assert.ok(meanMs < .2);
  assert.ok(maxMs < 50);
});
