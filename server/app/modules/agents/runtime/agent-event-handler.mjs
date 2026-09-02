export class AgentEventHandler {
  constructor({ workflows = {} }) {
    this.workflows = workflows;
  }

  async handle(event) {
    const workflow = this.workflows[event.type];

    if (!workflow) return null;

    return workflow.execute(event.payload || {});
  }
}
