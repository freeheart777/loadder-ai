export class ActionRunner {
  constructor({ toolRegistry, permissionEngine, eventBus } = {}) {
    this.toolRegistry = toolRegistry;
    this.permissionEngine = permissionEngine;
    this.eventBus = eventBus;
  }

  async run({ agent, action, tool, input = {} }) {
    if (this.permissionEngine && !this.permissionEngine.can(agent, action)) {
      throw new Error("Agent action denied");
    }

    const result = await this.toolRegistry.execute(tool, input);

    if (this.eventBus) {
      await this.eventBus.publish({
        type: "agent.action.completed",
        payload: {
          agent: agent.name,
          action,
          result,
        },
      });
    }

    return result;
  }
}
