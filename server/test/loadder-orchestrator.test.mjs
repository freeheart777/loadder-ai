import assert from "node:assert/strict";
import test from "node:test";
import { createLoadderOrchestrator, OrchestratorError } from "../app/orchestration/loadder-orchestrator.mjs";
import { createSkillRegistry } from "../app/skills/skill-registry.mjs";

function brain() { return { async get() { return { projectId: "p1", version: 3, facts: {} }; } }; }

test("orchestrator plans with project brain context and resolved skills", async () => {
  const skills = createSkillRegistry([{ id: "research", name: "Research" }, { id: "report", name: "Report", dependsOn: ["research"] }]);
  const execution = { async run(request) { return { status: "completed", request }; } };
  const orchestrator = createLoadderOrchestrator({ brain: brain(), skills, execution });
  const plan = await orchestrator.plan({ projectId: "p1", skillIds: ["report"], input: "analyze competitors" });
  assert.equal(plan.brainVersion, 3);
  assert.deepEqual(plan.skills.map((skill) => skill.id), ["report", "research"]);
});

test("orchestrator rejects incomplete requests", async () => {
  const orchestrator = createLoadderOrchestrator({ brain: brain(), skills: createSkillRegistry(), execution: { run: async () => ({}) } });
  await assert.rejects(() => orchestrator.plan({ projectId: "p1", skillIds: [] , input: "x" }), (error) => error instanceof OrchestratorError && error.code === "INVALID_SKILLS");
});
