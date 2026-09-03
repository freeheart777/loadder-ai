import test from "node:test";
import assert from "node:assert/strict";
import { loadderBusinessCompiler } from "../app/business-builder/business-compiler.mjs";
import { renderLoadderApp } from "../app/business-builder/app-renderer.mjs";

test("renderer turns a compiled Persian CRM into RTL dashboard and resource views", () => {
  const definition = loadderBusinessCompiler.compile({
    intent: "برای شرکت پخش من CRM فروش و مدیریت مشتری بساز",
    name: "مرکز فروش",
    locale: "fa-IR",
  });
  const ui = renderLoadderApp(definition);

  assert.equal(ui.renderContract, "loadder.ui.v1");
  assert.equal(ui.direction, "rtl");
  assert.equal(ui.views[0].type, "dashboard");
  assert.ok(ui.navigation.some((item) => item.id === "customer"));
  assert.ok(ui.views.some((view) => view.id === "customer-list"));
  assert.ok(ui.views.some((view) => view.id === "customer-create"));
  assert.ok(ui.views.some((view) => view.id === "customer-detail"));
});

test("renderer maps schema field types to stable Loadder UI components", () => {
  const definition = loadderBusinessCompiler.compile({ intent: "CRM sales for our business", locale: "en-US" });
  const ui = renderLoadderApp(definition);
  const createView = ui.views.find((view) => view.type === "resource-form");
  assert.ok(createView);
  assert.ok(createView.blocks[0].fields.every((field) => typeof field.component === "string"));
  assert.equal(ui.direction, "ltr");
});

test("renderer remains framework independent", () => {
  const definition = loadderBusinessCompiler.compile({ intent: "inventory and warehouse system" });
  const ui = renderLoadderApp(definition);
  const serialized = JSON.stringify(ui);
  assert.equal(serialized.includes("react"), false);
  assert.equal(serialized.includes("vite"), false);
  assert.equal(serialized.includes("supabase"), false);
});
