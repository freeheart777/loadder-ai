const TRANSITIONS = Object.freeze({
  PLANNED: new Set(["RUNNING", "CANCELLED"]),
  RUNNING: new Set(["COMPLETED", "FAILED", "CANCELLED"]),
  COMPLETED: new Set(),
  FAILED: new Set(),
  CANCELLED: new Set(),
});

export class ExperimentRunError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ExperimentRunError";
    this.code = code;
    this.status = status;
  }
}

export function createExperimentRunService({ repository, now = () => new Date().toISOString() }) {
  const get = (id) => {
    const run = repository.get(id);
    if (!run) throw new ExperimentRunError("EXPERIMENT_RUN_NOT_FOUND", "Experiment run was not found.", 404);
    return run;
  };

  const create = ({ experimentId, contextVersionId }) => {
    if (!experimentId || !contextVersionId) throw new ExperimentRunError("EXPERIMENT_RUN_INPUT_INVALID", "experimentId and contextVersionId are required.");
    const experiment = repository.getExperiment(experimentId);
    if (!experiment) throw new ExperimentRunError("EXPERIMENT_NOT_FOUND", "Experiment was not found.", 404);
    if (experiment.context_version_id !== contextVersionId) throw new ExperimentRunError("EXPERIMENT_RUN_CONTEXT_MISMATCH", "Run context must match the experiment context.", 409);
    const run = repository.create({ experimentId, contextVersionId, now: now() });
    if (!run) throw new ExperimentRunError("EXPERIMENT_NOT_FOUND", "Experiment was not found.", 404);
    return run;
  };

  const transition = (id, target, { contextVersionId, outcome } = {}) => {
    const run = get(id);
    if (contextVersionId && run.contextVersionId !== contextVersionId) throw new ExperimentRunError("EXPERIMENT_RUN_CONTEXT_MISMATCH", "Experiment run is pinned to a different business context.", 409);
    if (!TRANSITIONS[run.status]?.has(target)) throw new ExperimentRunError("EXPERIMENT_RUN_INVALID_TRANSITION", `Cannot transition experiment run from ${run.status} to ${target}.`, 409);
    const at = now();
    return repository.updateStatus({
      id,
      status: target,
      startedAt: target === "RUNNING" ? at : undefined,
      completedAt: ["COMPLETED", "FAILED", "CANCELLED"].includes(target) ? at : undefined,
      outcome,
      now: at,
    });
  };

  return Object.freeze({
    create,
    get,
    list: (filters) => repository.list(filters),
    start: (id, options) => transition(id, "RUNNING", options),
    complete: (id, options) => transition(id, "COMPLETED", options),
    fail: (id, options) => transition(id, "FAILED", options),
    cancel: (id, options) => transition(id, "CANCELLED", options),
  });
}
