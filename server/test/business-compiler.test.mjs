import test from "node:test";
import assert from "node:assert/strict";
import { LoadderBusinessCompiler } from "../app/business-builder/business-compiler.mjs";
import { LoadderAppSchemaError, validateLoadderAppDefinition } from "../app/business-builder/loadder-app-schema.mjs";

const compiler = new LoadderBusinessCompiler();

test("compiles a Persian CRM + inventory intent into a provider-independent Loadder app", () => {
  const app = compiler.compile({
    id: "iraq-food-distribution",
    name: "Iraq Food Distribution",
    intent: "برای شرکت پخش مواد غذایی یک CRM فروش و سیستم انبار و موجودی بساز",
    locale: "fa-IR",
  });

  assert.equal(app.schemaVersion, "1.0");
  assert.equal(app.id, "iraq-food-distribution");
  assert.equal(app.ownership.sourceOfTruth, "loadder-app-definition");
  assert.equal(app.ownership.providerIndependent, true);
  assert.equal(app.deployment.provider, "loadder");

  const entityIds = new Set(app.entities.map((entity) => entity.id));
  assert.ok(entityIds.has("customer"));
  assert.ok(entityIds.has("opportunity"));
  assert.ok(entityIds.has("product"));
  assert.ok(entityIds.has("warehouse"));
  assert.ok(entityIds.has("stock"));

  assert.ok(app.roles.some((role) => role.id === "admin"));
  assert.ok(app.agents.some((agent) => agent.provider === "loadder-ai-gateway"));
});

test("compiles a booking application without requiring an external AI provider", () => {
  const app = compiler.compile({
    name: "Clinic Scheduler",
    intent: "برای کلینیک سیستم نوبت و رزرو و مدیریت مشتری بساز",
  });

  assert.equal(app.vertical, "healthcare");
  assert.ok(app.entities.some((entity) => entity.id === "booking"));
  assert.ok(app.pages.some((page) => page.id === "calendar"));
});

test("fails closed when an app definition contains a broken relationship", () => {
  assert.throws(() => validateLoadderAppDefinition({
    schemaVersion: "1.0",
    id: "broken",
    name: "Broken",
    vertical: "test",
    entities: [{ id: "customer", name: "Customer", fields: [{ id: "name", type: "string" }] }],
    relationships: [{ id: "broken-link", from: "customer", to: "missing", type: "one-to-many" }],
    roles: [{ id: "admin", name: "Admin" }],
    workflows: [],
  }), LoadderAppSchemaError);
});
