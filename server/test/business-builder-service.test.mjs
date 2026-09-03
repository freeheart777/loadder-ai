import test from "node:test";
import assert from "node:assert/strict";
import { LoadderBusinessBuilderService } from "../app/business-builder/business-builder-service.mjs";

test("service produces one owned build plan from business intent", () => {
  const service = new LoadderBusinessBuilderService({ buildIdFactory: () => "build-test" });
  const plan = service.plan({ intent: "برای شرکت لجستیک CRM فروش و انبار بساز", name: "عملیات لودر", locale: "fa-IR" });

  assert.equal(plan.contract, "loadder.business-build-plan.v1");
  assert.equal(plan.buildId, "build-test");
  assert.equal(plan.definition.ownership.sourceOfTruth, "loadder-app-definition");
  assert.equal(plan.definition.ownership.providerIndependent, true);
  assert.equal(plan.ui.direction, "rtl");
  assert.equal(plan.sandbox.isolation.noNewPrivileges, true);
  assert.equal(plan.next.productionDeploymentAllowed, false);
  assert.ok(plan.gates.some((gate) => gate.id === "human-approval-before-production" && gate.status === "required"));
});
