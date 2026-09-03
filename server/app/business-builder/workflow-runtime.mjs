const STEP_TYPES = new Set(["trigger", "condition", "action", "agent", "complete"]);

export class LoadderWorkflowError extends Error {
  constructor(message, code = "LOADDER_WORKFLOW_FAILED") {
    super(message);
    this.name = "LoadderWorkflowError";
    this.code = code;
  }
}

export class LoadderWorkflowRuntime {
  constructor({ actions = {}, agents = {}, audit = () => {} } = {}) {
    this.actions = actions;
    this.agents = agents;
    this.audit = audit;
  }

  async execute({ definition, workflowId, input = {}, context = {} }) {
    const workflow = definition?.workflows?.find((item) => item.id === workflowId);
    if (!workflow) throw new LoadderWorkflowError(`Unknown workflow: ${workflowId}`, "LOADDER_WORKFLOW_NOT_FOUND");
    const state = { input, context, outputs: [], status: "running" };

    for (const step of workflow.steps || []) {
      if (!STEP_TYPES.has(step.type)) throw new LoadderWorkflowError(`Unsupported step type: ${step.type}`);
      let output = null;
      if (step.type === "trigger") output = { accepted: true };
      if (step.type === "condition") {
        const fn = this.actions[step.handler];
        if (!fn) throw new LoadderWorkflowError(`Missing condition handler: ${step.handler}`);
        const passed = Boolean(await fn({ step, state }));
        output = { passed };
        if (!passed) { state.status = "skipped"; break; }
      }
      if (step.type === "action") {
        const fn = this.actions[step.handler];
        if (!fn) throw new LoadderWorkflowError(`Missing action handler: ${step.handler || step.id}`);
        output = await fn({ step, state });
      }
      if (step.type === "agent") {
        const agent = this.agents[step.agentId];
        if (!agent) throw new LoadderWorkflowError(`Missing agent binding: ${step.agentId}`);
        output = await agent({ step, state });
      }
      if (step.type === "complete") state.status = "completed";
      state.outputs.push({ stepId: step.id, type: step.type, output });
      this.audit({ type: "workflow.step", appId: definition.id, workflowId, stepId: step.id, stepType: step.type });
    }

    if (state.status === "running") state.status = "completed";
    this.audit({ type: "workflow.completed", appId: definition.id, workflowId, status: state.status });
    return state;
  }
}

export { STEP_TYPES };
