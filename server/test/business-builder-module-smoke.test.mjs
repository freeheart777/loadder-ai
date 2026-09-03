import test from "node:test";
import assert from "node:assert/strict";

const modules = [
  "../app/business-builder/business-blueprints.mjs",
  "../app/business-builder/business-compiler.mjs",
  "../app/business-builder/app-renderer.mjs",
  "../app/business-builder/editor-patch.mjs",
  "../app/business-builder/navigator.mjs",
  "../app/business-builder/project-service.mjs",
  "../app/business-builder/runtime-router.mjs",
  "../app/business-builder/deployment-controller.mjs",
];

test("LES Jidoka: critical Business Builder modules parse and import", async () => {
  for (const specifier of modules) {
    const imported = await import(specifier);
    assert.ok(imported && typeof imported === "object", `${specifier} did not import`);
  }
});
