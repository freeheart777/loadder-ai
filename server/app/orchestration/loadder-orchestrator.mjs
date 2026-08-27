import { randomUUID } from "node:crypto";

export class OrchestratorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OrchestratorError";
    this.code = code;
    this.details = details;
  }
}

export function createLoadderOrchestrator({ brain, skills, execution, audit = null }) {
  if (!brain?.get) throw new TypeError("brain must implement get");
  if (!skills?.resolve) throw new TypeError("skills must implement resolve");
  if (!execution?.run) throw new TypeError("execution must implement run");
  if (audit !== null && typeof audit.record !== "function") throw new TypeError("audit must implement record");

  const record = async (event) => audit?.record?.({ source: "loadder-orchestrator", ...event });

  return Object.freeze({
    async plan({ projectId, skillIds = [], input }) {
      if (!projectId) throw new OrchestratorError("INVALID_PROJECT", "projectId is required");
      if (!Array.isArray(skillIds) || skillIds.length === 0) throw new OrchestratorError("INVALID_SKILLS", "at least one skill is required");
      if (input === undefined) throw new OrchestratorError("INVALID_INPUT", "input is required");
      const projectBrain = await brain.get(projectId);
      const resolvedSkills = skills.resolve(skillIds);
      if (resolvedSkills.length === 0) throw new OrchestratorError("SKILLS_NOT_FOUND", "no requested skills are registered");
      return { projectId, brainVersion: projectBrain.version, skills: resolvedSkills, input };
    },

    async run(request) {
      const plan = await this.plan(request);
      const executionId = request.executionId ?? randomUUID();
      await record({ type: "execution.queued", executionId, projectId: plan.projectId, brainVersion: plan.brainVersion, skillIds: plan.skills.map(({ id }) => id) });
      try {
        const result = await execution.run({ executionId, projectId: plan.projectId, brainVersion: plan.brainVersion, skills: plan.skills.map(({ id, name }) => ({ id, name })), input: plan.input });
        await record({ type: "execution.completed", executionId, projectId: plan.projectId });
        return result;
      } catch (error) {
        await record({ type: "execution.failed", executionId, projectId: plan.projectId, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
  });
}
