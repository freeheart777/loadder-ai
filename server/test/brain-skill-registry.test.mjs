import assert from "node:assert/strict";
import test from "node:test";
import { createProjectBrain } from "../app/brain/project-brain.mjs";
import { createSkillRegistry } from "../app/skills/skill-registry.mjs";

function memoryStore() { const map = new Map(); return { async get(id) { return map.get(id); }, async save(value) { map.set(value.projectId, value); } }; }

test("project brain persists versioned context", async () => {
  const brain = createProjectBrain({ store: memoryStore() });
  const first = await brain.get("p1");
  assert.equal(first.version, 1);
  const next = await brain.update("p1", { facts: { product: "Loadder" }, rules: ["never expose secrets"] });
  assert.equal(next.version, 2); assert.equal(next.facts.product, "Loadder");
});

test("skill registry resolves declared dependencies", () => {
  const registry = createSkillRegistry([
    { id: "research", name: "Research" },
    { id: "competitor", name: "Competitor Analysis", dependsOn: ["research"] },
  ]);
  assert.equal(registry.get("research").name, "Research");
  assert.deepEqual(registry.resolve(["competitor"]).map((s) => s.id), ["competitor", "research"]);
});
