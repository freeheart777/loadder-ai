export class ExperimentProviderExecutionError extends Error {
  constructor(message, code = "EXPERIMENT_PROVIDER_EXECUTION_ERROR") {
    super(message);
    this.name = "ExperimentProviderExecutionError";
    this.code = code;
  }
}

export function createProviderExecutor({ provider }) {
  if (typeof provider !== "function") {
    throw new TypeError("provider must be a function");
  }

  return async function execute({ plan, run, input }) {
    if (!plan || !run) throw new ExperimentProviderExecutionError("plan and run are required.", "EXPERIMENT_EXECUTION_CONTEXT_INVALID");
    const result = await provider({ plan, run, input });
    if (result === null || typeof result !== "object" || Array.isArray(result)) {
      throw new ExperimentProviderExecutionError("provider must return a JSON object.", "EXPERIMENT_PROVIDER_RESULT_INVALID");
    }
    return result;
  };
}
