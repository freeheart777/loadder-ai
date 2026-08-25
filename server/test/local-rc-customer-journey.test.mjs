import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landing = readFileSync(new URL("../../src/pages/LandingBuilderPage.tsx", import.meta.url), "utf8");
const website = readFileSync(new URL("../../src/pages/WebsiteBuilderPage.tsx", import.meta.url), "utf8");

test("local RC launch-visible builders require a real customer CTA", async (t) => {
  await t.test("Landing does not persist or publish the example destination", () => {
    assert.equal(landing.includes('target: "https://example.com"'), false);
    assert.match(landing, /نشانی دکمه اقدام/);
    assert.match(landing, /if \(!ctaReady\).*نشانی HTTPS واقعی/);
    assert.match(landing, /disabled=\{busy \|\| !ctaReady\}/);
  });

  await t.test("Website creation and publication reject placeholder destinations", () => {
    assert.equal(website.includes('target: "https://wa.me/989120000000"'), false);
    assert.match(website, /pageBlueprint\(p\.name, p\.sections, ctaTarget\)/);
    assert.match(website, /if \(!validLaunchCta\(ctaTarget\)\)/);
    assert.match(website, /پیش از انتشار، نشانی واقعی دکمه اقدام/);
  });
});
