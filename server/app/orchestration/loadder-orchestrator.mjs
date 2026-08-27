import { randomUUID } from "node:crypto";

export class OrchestratorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OrchestratorError";
    this.code = code;
    this.details = details;
  }
}

export function createLoadderOrchestrator({ brain, skills, execution }) {
  if (!brain?.get) throw new TypeError("brain must implement get");
  if (!skills?.resolve) throw new TypeError("skills must implement resolve");
  if (!execution?.run) throw new TypeError("execution must implement run");

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
      return execution.run({ executionId, projectId: plan.projectId, brainVersion: plan.brainVersion, skills: plan.skills.map(({ id, name }) => ({ id, name })), input: plan.input });
    },
  });
}
