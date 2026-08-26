import { evaluateGuardrails } from "./metric-guardrails.mjs";

export class ExperimentExecutionError extends Error {
  constructor(message, status = 400, code = "EXPERIMENT_EXECUTION_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const requireText = (value, field) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ExperimentExecutionError(`${field} is required.`);
  }
  return value.trim();
};

export function createExperimentExecutionService({ experimentRepository, runService, hypothesisEngine, guardrails = [] }) {
  const getExperiment = (id) => {
    const experiment = experimentRepository.get(id);
    if (!experiment) throw new ExperimentExecutionError("Experiment not found.", 404, "EXPERIMENT_NOT_FOUND");
    return experiment;
  };

  function plan(experimentId) {
    const experiment = getExperiment(experimentId);
    const hypothesis = hypothesisEngine?.fromExperiment
      ? hypothesisEngine.fromExperiment(experiment)
      : {
          statement: experiment.hypothesis,
          sourceExperimentId: experiment.id,
          confidence: null,
        };

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
      executionMode: "MANUAL_RESULT_SUBMISSION",
    });
  }

  function start(experimentId) {
    const planResult = plan(experimentId);
    const run = runService.create({ experimentId, contextVersionId: planResult.contextVersionId });
    return Object.freeze({ plan: planResult, run: runService.start(run.id, { contextVersionId: planResult.contextVersionId }) });
  }

  function recordResult(runId, { contextVersionId, result }) {
    if (result === null || typeof result !== "object" || Array.isArray(result)) {
      throw new ExperimentExecutionError("result must be a JSON object.");
    }
    const checks = evaluateGuardrails(result, guardrails);
    const passed = checks.every((check) => check.passed);
    const outcome = { result, guardrails: checks, guardrailsPassed: passed };
    const run = passed
      ? runService.complete(runId, { contextVersionId, outcome })
      : runService.fail(runId, { contextVersionId, outcome });
    return Object.freeze({ run, outcome });
  }

  return Object.freeze({ plan, start, recordResult });
}
