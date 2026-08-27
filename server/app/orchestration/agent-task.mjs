import { randomUUID } from "node:crypto";

export class AgentTaskError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AgentTaskError";
    this.code = code;
    this.details = details;
  }
}

export function createAgentTask({ projectId, skillId, input, parentTaskId = null, taskId = randomUUID() }) {
  if (!projectId) throw new AgentTaskError("INVALID_PROJECT", "projectId is required");
  if (!skillId) throw new AgentTaskError("INVALID_SKILL", "skillId is required");
  if (input === undefined) throw new AgentTaskError("INVALID_INPUT", "input is required");
  return Object.freeze({
    taskId,
    projectId,
    skillId,
    parentTaskId,
    input,
    status: "queued",
    createdAt: new Date().toISOString(),
  });
}
