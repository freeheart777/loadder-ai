import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeVisualPilotProps,
  shouldUseStaticVisual,
  visualPilotFrame,
  VISUAL_PILOT_CONTRACT,
} from "../../src/internal/visual-pilot/visualPilotPolicy.ts";

const component = readFileSync(new URL("../../src/internal/visual-pilot/LoadderDotMatrixPilot.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../src/pages/internal/VisualRuntimePilotPage.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const policy = readFileSync(new URL("../../src/lib/productPolicy.ts", import.meta.url), "utf8");

test("native visual runtime pilot", async t => {
  await t.test("contract is bounded to one interactive instance", () => {
    assert.equal(VISUAL_PILOT_CONTRACT.componentId, "LOADDER_DOT_MATRIX");
    assert.equal(VISUAL_PILOT_CONTRACT.runtimeTier, "INTERACTIVE");
    assert.equal(VISUAL_PILOT_CONTRACT.maxInstancesPerPage, 1);
  });
  await t.test("numeric props clamp and invalid values converge", () => {
    assert.deepEqual(normalizeVisualPilotProps({ density: 999, intensity: -1, speed: Number.NaN }), { density: 64, intensity: .25, speed: .18, motionEnabled: true, qualityTier: "BALANCED" });
  });
  await t.test("reduced motion mobile low power and explicit low tier are static", () => {
    for (const input of [{ reducedMotion: true }, { mobile: true }, { lowPower: true }, { motionEnabled: false }, { qualityTier: "LOW" }]) assert.equal(shouldUseStaticVisual(input), true);
    assert.equal(shouldUseStaticVisual(), false);
  });
  await t.test("animation calculation is deterministic bounded and allocation-free in shape", () => {
    assert.equal(visualPilotFrame(10, .2), 2);
    assert.equal(visualPilotFrame(-1, 9), 0);
  });
  await t.test("runtime owns exactly one decorative canvas and one raw WebGL context", () => {
    assert.equal((component.match(/<canvas\b/g) || []).length, 1);
    assert.equal((component.match(/getContext\("webgl"/g) || []).length, 1);
    assert.match(component, /aria-hidden="true"/);
  });
  await t.test("RAF pauses offscreen and hidden and is cancelled on cleanup", () => {
    assert.match(component, /IntersectionObserver/);
    assert.match(component, /document\.hidden/);
    assert.match(component, /visibilitychange/);
    assert.match(component, /cancelAnimationFrame/);
    assert.match(component, /if \(!disposed && visible && !document\.hidden && !frame\)/);
  });
  await t.test("observers listeners buffers programs and context are released", () => {
    for (const evidence of [/resizeObserver\?\.disconnect/, /intersection\?\.disconnect/, /removeEventListener\("visibilitychange"/, /removeEventListener\("webglcontextlost"/, /deleteBuffer/, /deleteProgram/, /WEBGL_lose_context/]) assert.match(component, evidence);
  });
  await t.test("WebGL initialization and context loss fail to static fallback", () => {
    assert.match(component, /if \(!gl\) throw/);
    assert.match(component, /webglcontextlost/);
    assert.match(component, /setState\("failed"\)/);
    assert.match(component, /StaticDotFallback/);
  });
  await t.test("DPR resize and per-frame React discipline are explicit", () => {
    assert.match(component, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
    assert.match(component, /ResizeObserver/);
    const renderBody = component.slice(component.indexOf("const render ="), component.indexOf("const start ="));
    assert.doesNotMatch(renderBody, /setState|new |\.map\(|\.filter\(/);
  });
  await t.test("page keeps semantic content and navigation outside the visual", () => {
    assert.match(page, /<h1/);
    assert.match(page, /<Link/);
    assert.match(page, /lazy\(\(\) => import/);
    assert.doesNotMatch(component, /tabIndex|onKeyDown|<h1|<a\b|<button/);
  });
  await t.test("route is internal dev-gated and absent from customer allowlist", () => {
    assert.match(app, /internalToolsEnabled \? <VisualRuntimePilotPage \/> : <Navigate to="\/dashboard" replace \/>/);
    assert.match(policy, /INTERNAL_ROUTE_ALLOWLIST/);
    assert.match(policy, /\/dashboard\/internal\/visual-pilot/);
    const customer = policy.slice(policy.indexOf("CUSTOMER_ROUTE_ALLOWLIST"), policy.indexOf("INTERNAL_ROUTE_ALLOWLIST"));
    assert.doesNotMatch(customer, /visual-pilot/);
  });
  await t.test("pilot has no external runtime security or persistence surface", () => {
    const source = `${component}\n${page}`;
    for (const forbidden of ["threeui", "@designcodeio", "from \"three\"", "http://", "https://", "<iframe", "srcDoc", "dangerouslySetInnerHTML", "eval(", "new Function", "fetch(", "/api/", "localStorage", "sessionStorage"]) assert.equal(source.includes(forbidden), false, forbidden);
  });
});

test("1000 deterministic animation-step calculations remain bounded", () => {
  const started = process.hrtime.bigint();
  let checksum = 0;
  for (let i = 0; i < 1000; i += 1) checksum += visualPilotFrame(i / 60, .18);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(checksum > 0);
  assert.ok(elapsedMs < 100);
});
