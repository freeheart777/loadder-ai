import test from "node:test";
import assert from "node:assert/strict";
import { LoadderBusinessBuilderService } from "../app/business-builder/business-builder-service.mjs";
import { materializeLoadderSourceBundle } from "../app/business-builder/source-materializer.mjs";
import { loadderBusinessCompiler } from "../app/business-builder/business-compiler.mjs";
import { renderLoadderApp } from "../app/business-builder/app-renderer.mjs";

test("materializer produces a portable Loadder-owned bundle", () => {
  const definition = loadderBusinessCompiler.compile({ intent: "برای فروش یک CRM و انبار بساز", locale: "fa-IR" });
  const ui = renderLoadderApp(definition);
  const bundle = materializeLoadderSourceBundle({ definition, ui });
  assert.equal(bundle.contract, "loadder.source-bundle.v1");
  assert.equal(bundle.portable, true);
  assert.equal(bundle.externalRuntimeRequired, false);
  assert.equal(bundle.manifest.ownership.sourceOfTruth, "loadder-app-definition");
  assert.deepEqual(bundle.files.map((file) => file.path), ["loadder.manifest.json", "app.definition.json", "ui.definition.json", "README.md"]);
});

test("preview completes intent -> definition -> ui -> bundle without production deploy", () => {
  const service = new LoadderBusinessBuilderService({ buildIdFactory: () => "build-test" });
  const preview = service.preview({ intent: "برای کلینیک سیستم رزرو و CRM بساز", locale: "fa-IR" });
  assert.equal(preview.contract, "loadder.business-preview.v1");
  assert.equal(preview.buildId, "build-test");
  assert.equal(preview.ui.direction, "rtl");
  assert.ok(preview.definition.entities.length > 0);
  assert.ok(preview.ui.views.length > preview.definition.entities.length);
  assert.equal(preview.sourceBundle.portable, true);
  assert.equal(preview.productionDeploymentAllowed, false);
  assert.equal(preview.gates.find((gate) => gate.id === "portable-source-bundle")?.status, "passed");
  assert.equal(preview.gates.find((gate) => gate.id === "human-approval-before-production")?.status, "required");
});

test("materializer rejects a UI contract for another app", () => {
  const definition = loadderBusinessCompiler.compile({ intent: "CRM بساز" });
  const ui = { ...renderLoadderApp(definition), appId: "other-app" };
  assert.throws(() => materializeLoadderSourceBundle({ definition, ui }), /does not match/);
});
