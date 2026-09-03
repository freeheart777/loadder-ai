import test from "node:test";
import assert from "node:assert/strict";
import { loadderBusinessCompiler } from "../app/business-builder/business-compiler.mjs";
import { renderLoadderApp } from "../app/business-builder/app-renderer.mjs";
import { materializeLoadderSourceBundle } from "../app/business-builder/source-materializer.mjs";
import { LoadderDataRuntime } from "../app/business-builder/data-adapter.mjs";
import { LoadderWorkflowRuntime } from "../app/business-builder/workflow-runtime.mjs";
import { exportLoadderApplication, importLoadderApplication } from "../app/business-builder/portability.mjs";
import { LoadderDeploymentController } from "../app/business-builder/deployment-controller.mjs";

const definition = loadderBusinessCompiler.compile({ intent: "برای فروش CRM بساز", locale: "fa-IR" });

test("data runtime validates entity schema before delegating CRUD", async () => {
  let created;
  const runtime = new LoadderDataRuntime({ adapter: {
    list: async () => [], get: async () => null,
    create: async ({ payload }) => (created = { id: "r1", ...payload }),
    update: async () => ({}), delete: async () => ({ deleted: true }),
  }});
  const entity = definition.entities[0];
  const payload = Object.fromEntries((entity.fields || []).filter((f) => f.required).map((f) => [f.id, "value"]));
  const result = await runtime.execute({ definition, action: "create", entityId: entity.id, payload });
  assert.equal(result.id, "r1");
  assert.deepEqual(result, created);
  await assert.rejects(() => runtime.execute({ definition, action: "create", entityId: entity.id, payload: { forbidden: true } }), /Unknown field/);
});

test("workflow runtime executes declared deterministic actions", async () => {
  const custom = structuredClone(definition);
  custom.workflows = [{ id: "wf", name: "WF", steps: [{ id: "start", type: "trigger" }, { id: "do", type: "action", handler: "mark" }, { id: "done", type: "complete" }] }];
  const runtime = new LoadderWorkflowRuntime({ actions: { mark: async () => ({ ok: true }) } });
  const state = await runtime.execute({ definition: custom, workflowId: "wf" });
  assert.equal(state.status, "completed");
  assert.equal(state.outputs[1].output.ok, true);
});

test("export and import preserve Loadder-owned application contract", () => {
  const ui = renderLoadderApp(definition);
  const bundle = materializeLoadderSourceBundle({ definition, ui });
  const exported = exportLoadderApplication({ project: { name: definition.name, intent: definition.description, locale: definition.locale }, version: { versionNumber: 1, definition, ui, bundle } });
  const imported = importLoadderApplication(exported);
  assert.equal(imported.version.definition.id, definition.id);
  assert.equal(imported.version.definition.ownership.providerIndependent, true);
});

test("deployment controller blocks unapproved production", async () => {
  const controller = new LoadderDeploymentController({
    projectService: { canDeployProduction: () => false },
    adapter: { deployCanary: async () => ({}), promote: async () => ({}), rollback: async () => ({}) },
  });
  await assert.rejects(() => controller.deploy({ projectId: "p1", version: { id: "v1" } }), (error) => error?.code === "LOADDER_PRODUCTION_APPROVAL_REQUIRED");
});

test("failed canary health check rolls back and never promotes", async () => {
  let rolledBack = false, promoted = false;
  const controller = new LoadderDeploymentController({
    projectService: { canDeployProduction: () => true },
    healthCheck: async () => ({ healthy: false, reason: "smoke-failed" }),
    adapter: {
      deployCanary: async () => ({ id: "d1" }),
      promote: async () => { promoted = true; return {}; },
      rollback: async () => { rolledBack = true; },
    },
  });
  await assert.rejects(() => controller.deploy({ projectId: "p1", version: { id: "v1" } }), (error) => error?.code === "LOADDER_CANARY_FAILED");
  assert.equal(rolledBack, true);
  assert.equal(promoted, false);
});
