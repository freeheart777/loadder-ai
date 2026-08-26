const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const TRANSITIONS = new Map([
  ["PLANNED", new Set(["RUNNING"])],
  ["RUNNING", new Set(["COMPLETED", "FAILED", "CANCELLED"])],
]);

export class ExperimentRunError extends Error {
  constructor(message, status = 400, code = "EXPERIMENT_RUN_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const limitValue = (value) => {
  const n = Number(value ?? 50);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new ExperimentRunError("limit is invalid.");
  return n;
};

const validateContext = (run, contextVersionId) => {
  if (!contextVersionId || contextVersionId !== run.contextVersionId) {
    throw new ExperimentRunError("Context version does not match the pinned run context.", 409, "EXPERIMENT_CONTEXT_MISMATCH");
  }
};

const validateOutcome = (outcome) => {
  if (outcome === undefined) return;
  if (outcome === null || typeof outcome !== "object" || Array.isArray(outcome)) {
    throw new ExperimentRunError("outcome must be a JSON object.");
  }
  const encoded = JSON.stringify(outcome);
  if (encoded.length > 32768) throw new ExperimentRunError("outcome is too large.", 413, "EXPERIMENT_OUTCOME_TOO_LARGE");
};

export function createExperimentRunService({ repository, now = () => new Date() }) {
  const timestamp = () => now().toISOString();
  const getOrThrow = (id) => {
    const run = repository.get(id);
    if (!run) throw new ExperimentRunError("Experiment run not found.", 404, "EXPERIMENT_RUN_NOT_FOUND");
    return run;
  };

  function create({ experimentId, contextVersionId }) {
    if (!experimentId || !contextVersionId) throw new ExperimentRunError("experimentId and contextVersionId are required.");
    const experiment = repository.getExperiment(experimentId);
    if (!experiment) throw new ExperimentRunError("Experiment not found.", 404, "EXPERIMENT_NOT_FOUND");
    if (experiment.context_version_id !== contextVersionId) throw new ExperimentRunError("Context version does not match the experiment.", 409, "EXPERIMENT_CONTEXT_MISMATCH");
    if (experiment.status !== "READY" && experiment.status !== "RUNNING") throw new ExperimentRunError("Experiment is not ready to run.", 409, "EXPERIMENT_NOT_RUNNABLE");
    const run = repository.create({ experimentId, contextVersionId, now: timestamp() });
    if (!run) throw new ExperimentRunError("Experiment not found.", 404, "EXPERIMENT_NOT_FOUND");
    return run;
  }

  function list({ experimentId, status, limit, cursor } = {}) {
    if (!experimentId) throw new ExperimentRunError("experimentId is required.");
    return repository.list({ experimentId, status, limit: limitValue(limit), cursor });
  }

  function change(id, { contextVersionId, outcome, to }) {
    const run = getOrThrow(id);
    validateContext(run, contextVersionId);
    if (TERMINAL.has(run.status)) throw new ExperimentRunError("Experiment run is already terminal.", 409, "EXPERIMENT_RUN_TERMINAL");
    if (!TRANSITIONS.get(run.status)?.has(to)) throw new ExperimentRunError(`Invalid experiment run transition: ${run.status} -> ${to}.`, 409, "EXPERIMENT_RUN_INVALID_TRANSITION");
    if (TERMINAL.has(to)) validateOutcome(outcome);
    const updated = repository.transition(id, { from: run.status, to, contextVersionId, now: timestamp(), outcome });
    if (!updated) throw new ExperimentRunError("Experiment run changed concurrently; retry with the current state.", 409, "EXPERIMENT_RUN_CONFLICT");
    return updated;
  }

  return Object.freeze({
    create,
    list,
    get: getOrThrow,
    start: (id, options) => change(id, { ...options, to: "RUNNING" }),
    complete: (id, options) => change(id, { ...options, to: "COMPLETED" }),
    fail: (id, options) => change(id, { ...options, to: "FAILED" }),
    cancel: (id, options) => change(id, { ...options, to: "CANCELLED" }),
  });
}
