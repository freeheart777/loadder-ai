export class AgentRuntime {
  constructor({ registry, actionRunner }) {
    this.registry = registry;
    this.actionRunner = actionRunner;
  }

  async execute({ agentName, goal, input }) {
    const agent = this.registry.get(agentName);

    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    return {
      agent: agent.name,
      goal,
      input,
      status: "ready"
    };
  }
}
