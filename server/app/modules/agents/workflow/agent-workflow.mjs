export class AgentWorkflow {
  constructor(steps = []) { this.steps = steps; }
  async run(input) {
    let state = input;
    for (const step of this.steps) state = await step(state);
    return state;
  }
}
