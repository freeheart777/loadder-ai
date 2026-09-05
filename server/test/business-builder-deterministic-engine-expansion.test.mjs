import test from "node:test";
import assert from "node:assert/strict";
import { loadderBusinessCompiler } from "../app/business-builder/business-compiler.mjs";
import { renderLoadderApp } from "../app/business-builder/app-renderer.mjs";
import { applyLoadderEditorPatch } from "../app/business-builder/editor-patch.mjs";
import { navigateLoadder } from "../app/business-builder/navigator.mjs";

test("deterministic engine composes project operations without AI", () => {
  const definition = loadderBusinessCompiler.compile({ intent: "برای شرکت من مدیریت پروژه، تسک و milestone بساز", name: "Projects" });
  assert.ok(definition.entities.some((entity) => entity.id === "project"));
  assert.ok(definition.entities.some((entity) => entity.id === "task"));
  assert.ok(definition.workflows.some((workflow) => workflow.id === "task_progress"));
});

test("deterministic engine builds approval tools without AI", () => {
  const definition = loadderBusinessCompiler.compile({ intent: "سیستم درخواست خرید و تایید مدیر بساز", name: "Approvals" });
  assert.ok(definition.entities.some((entity) => entity.id === "request"));
  assert.ok(definition.entities.some((entity) => entity.id === "approval"));
});

test("visual editor hides fields and renames navigation through validated patches", () => {
  const definition = loadderBusinessCompiler.compile({ intent: "CRM فروش بساز", name: "CRM" });
  const ui = renderLoadderApp(definition);
  const edited = applyLoadderEditorPatch(ui, {
    navigation: [{ id: "customer", label: "مشتریان من" }],
    fields: [{ entityId: "customer", fieldId: "phone", visible: false }],
  });
  assert.equal(edited.navigation.find((item) => item.id === "customer")?.label, "مشتریان من");
  const customerList = edited.views.find((view) => view.id === "customer-list");
  assert.equal(customerList.blocks.find((block) => block.type === "data-table").columns.some((column) => column.id === "phone"), false);
});

test("navigator remains zero-token and guides next step", () => {
  const result = navigateLoadder({ goal: "CRM فروش", screen: "builder", project: { id: "p1" } });
  assert.equal(result.tokenCost, 0);
  assert.equal(result.aiRequired, false);
  assert.ok(result.steps.some((step) => step.action === "open-preview"));
});
