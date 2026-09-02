export function createAgentTask({ agent, goal, input = {} }) {
  return {
    id: `task_${crypto.randomUUID()}`,
    agent,
    goal,
    input,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
}
