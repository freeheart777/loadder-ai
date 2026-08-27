import { evaluateGuardrails } from "./metric-guardrails.mjs";

export class ExperimentExecutionError extends Error {
  constructor(message, status = 400, code = "EXPERIMENT_EXECUTION_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const requireText = (value, field) => {
  if (typeof value !== "string" || !value.trim()) throw new ExperimentExecutionError(`${field} is required.`);
  return value.trim();
};

const optionalIdempotencyKey = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const key = requireText(value, "idempotencyKey");
  if (key.length > 200) throw new ExperimentExecutionError("idempotencyKey is too long.", 400, "EXPERIMENT_IDEMPOTENCY_KEY_INVALID");
  return key;
};

const runCreateOptions = (experimentId, contextVersionId, idempotencyKey) => ({
  experimentId,
  contextVersionId,
  ...(idempotencyKey ? { idempotencyKey } : {}),
});

export function createExperimentExecutionService({ experimentRepository, runService, hypothesisEngine, executor, guardrails = [] }) {
  const getExperiment = (id) => {
    const experiment = experimentRepository.get(id);
    if (!experiment) throw new ExperimentExecutionError("Experiment not found.", 404, "EXPERIMENT_NOT_FOUND");
    return experiment;
  };

  function plan(experimentId) {
    const experiment = getExperiment(experimentId);
    const hypothesis = hypothesisEngine?.fromExperiment
      ? hypothesisEngine.fromExperiment(experiment)
      : { statement: experiment.hypothesis, sourceExperimentId: experiment.id, confidence: null };
    return Object.freeze({
      experimentId: experiment.id,
      workspaceId: experiment.workspaceId ?? experiment.workspace_id ?? null,
      contextVersionId: experiment.contextVersionId ?? experiment.context_version_id,
      objective: requireText(experiment.objective, "objective"),
      successMetric: requireText(experiment.successMetric ?? experiment.success_metric, "successMetric"),
      treatmentDefinition: requireText(experiment.treatmentDefinition ?? experiment.treatment_definition, "treatmentDefinition"),
      baselineValue: experiment.baselineValue ?? experiment.baseline_value ?? null,
      hypothesis,
      guardrails: [...guardrails],
      executionMode: executor ? "INJECTED_EXECUTOR" : "MANUAL_RESULT_SUBMISSION",
    });
  }

  function start(experimentId, { idempotencyKey } = {}) {
    const planResult = plan(experimentId);
    const key = optionalIdempotencyKey(idempotencyKey);
    const existing = key ? runService.getByIdempotencyKey?.(key) : null;
    if (existing) {
      if (existing.experimentId !== experimentId || existing.contextVersionId !== planResult.contextVersionId) throw new ExperimentExecutionError("Idempotency key is already bound to another experiment run.", 409, "EXPERIMENT_IDEMPOTENCY_CONFLICT");
      return Object.freeze({ plan: planResult, run: existing });
    }
    const run = runService.create(runCreateOptions(experimentId, planResult.contextVersionId, key));
    return Object.freeze({ plan: planResult, run: runService.start(run.id, { contextVersionId: planResult.contextVersionId }) });
  }

  function recordResult(runId, { contextVersionId, result }) {
    if (result === null || typeof result !== "object" || Array.isArray(result)) throw new ExperimentExecutionError("result must be a JSON object.");
    const checks = evaluateGuardrails(result, guardrails);
    const passed = checks.every((check) => check.passed);
    const outcome = { result, guardrails: checks, guardrailsPassed: passed };
    const run = passed ? runService.complete(runId, { contextVersionId, outcome }) : runService.fail(runId, { contextVersionId, outcome });
    return Object.freeze({ run, outcome });
  }

  async function execute(experimentId, { input, idempotencyKey } = {}) {
    if (typeof executor !== "function") throw new ExperimentExecutionError("An executor is required for automatic execution.", 501, "EXPERIMENT_EXECUTOR_NOT_CONFIGURED");
    const planResult = plan(experimentId);
    const key = optionalIdempotencyKey(idempotencyKey);
    const existing = key ? runService.getByIdempotencyKey?.(key) : null;
    if (existing) {
      if (existing.experimentId !== experimentId || existing.contextVersionId !== planResult.contextVersionId) throw new ExperimentExecutionError("Idempotency key is already bound to another experiment run.", 409, "EXPERIMENT_IDEMPOTENCY_CONFLICT");
      return Object.freeze({ run: existing, outcome: existing.outcome });
    }

    const run = runService.create(runCreateOptions(experimentId, planResult.contextVersionId, key));
    const startedRun = runService.start(run.id, { contextVersionId: planResult.contextVersionId });
    try {
      const result = await executor({ plan: planResult, run: startedRun, input });
      return recordResult(startedRun.id, { contextVersionId: planResult.contextVersionId, result });
    } catch (error) {
      const outcome = { executionError: { name: error?.name ?? "Error", message: error?.message ?? String(error) } };
      const failedRun = runService.fail(startedRun.id, { contextVersionId: planResult.contextVersionId, outcome });
      return Object.freeze({ run: failedRun, outcome });
    }
  }

  return Object.freeze({ plan, start, recordResult, execute });
}
