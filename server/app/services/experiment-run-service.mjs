const TRANSITIONS = Object.freeze({
  PLANNED: new Set(["RUNNING", "CANCELLED"]),
  RUNNING: new Set(["COMPLETED", "FAILED", "CANCELLED"]),
  COMPLETED: new Set(),
  FAILED: new Set(),
  CANCELLED: new Set(),
});

const assertObject = (value, name) => {
  if (value !== undefined && (value === null || typeof value !== "object" || Array.isArray(value))) {
    const error = new Error(`${name} must be an object`);
    error.code = "INVALID_OUTCOME";
    throw error;
  }
};

export function createExperimentRunService({ repository, now = () => new Date() }) {
  const timestamp = () => now().toISOString();

  function create({ experimentId, contextVersionId, id } = {}) {
    if (!experimentId || !contextVersionId) {
      const error = new Error("experimentId and contextVersionId are required");
      error.code = "INVALID_RUN_INPUT";
      throw error;
    }
    const experiment = repository.getExperiment(experimentId);
    if (!experiment) {
      const error = new Error("experiment not found");
      error.code = "EXPERIMENT_NOT_FOUND";
      throw error;
    }
    if (experiment.context_version_id !== contextVersionId) {
      const error = new Error("experiment context is immutable and must be pinned");
      error.code = "CONTEXT_MISMATCH";
      throw error;
    }
    if (!["READY", "RUNNING"].includes(experiment.status)) {
      const error = new Error(`experiment status ${experiment.status} cannot create runs`);
      error.code = "EXPERIMENT_NOT_RUNNABLE";
      throw error;
    }
    const result = repository.create({ experimentId, contextVersionId, id, now: timestamp() });
    if (result.error) {
      const error = new Error(result.error);
      error.code = result.error;
      throw error;
    }
    return result.run;
  }

  function transition(id, target, { outcome } = {}) {
    const current = repository.getById(id);
    if (!current) {
      const error = new Error("experiment run not found");
      error.code = "RUN_NOT_FOUND";
      throw error;
    }
    if (!TRANSITIONS[current.status]?.has(target)) {
      const error = new Error(`invalid experiment run transition ${current.status} -> ${target}`);
      error.code = "INVALID_RUN_TRANSITION";
      throw error;
    }
    assertObject(outcome, "outcome");
    const at = timestamp();
    return repository.updateLifecycle(id, target, {
      startedAt: target === "RUNNING" ? (current.startedAt || at) : undefined,
      completedAt: ["COMPLETED", "FAILED", "CANCELLED"].includes(target) ? at : undefined,
      outcome,
      updatedAt: at,
    });
  }

  return Object.freeze({
    create,
    start: (id) => transition(id, "RUNNING"),
    complete: (id, outcome) => transition(id, "COMPLETED", { outcome }),
    fail: (id, outcome) => transition(id, "FAILED", { outcome }),
    cancel: (id, outcome) => transition(id, "CANCELLED", { outcome }),
    get: (id) => repository.getById(id),
    list: (filters) => repository.listPage(filters),
  });
}
