export class LoadderAgentBindingRegistry {
  constructor({ executor }) { if (!executor) throw new TypeError("agent executor is required"); this.executor = executor; }
  async execute({ definition, agentId, input = {}, context = {} }) {
    const agent = definition?.agents?.find((item) => item.id === agentId);
    if (!agent) { const error = new Error(`Unknown agent: ${agentId}`); error.code = "LOADDER_AGENT_NOT_FOUND"; throw error; }
    return this.executor({ appId: definition.id, agent, input, context });
  }
}

export function createGatewayAgentExecutor(gateway) {
  return async ({ appId, agent, input, context }) => gateway.generate({
    task: agent.task || "business_analysis",
    input: { appId, agent: { id: agent.id, name: agent.name, instructions: agent.instructions }, payload: input },
    context,
    privacy: agent.privacy === "private" ? "private" : "standard",
  });
}
