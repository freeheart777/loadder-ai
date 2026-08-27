export function createExperimentRunWorker({ runService, executor, now = () => new Date() }) {
  if (!runService) throw new TypeError("runService is required.");
  if (typeof executor !== "function") throw new TypeError("executor is required.");

  async function process({ runId, plan, input, leaseToken }) {
    const run = runService.claim?.(runId, { leaseToken, now: now() });
    if (!run) return { status: "NOT_CLAIMED", run: null };

    try {
      const result = await executor({ plan, run, input });
      return { status: "COMPLETED", ...runService.complete(run.id, { contextVersionId: run.contextVersionId, outcome: { result } }) };
    } catch (error) {
      const outcome = { executionError: { name: error?.name ?? "Error", message: error?.message ?? String(error) } };
      return { status: "FAILED", ...runService.fail(run.id, { contextVersionId: run.contextVersionId, outcome }) };
    }
  }

  return Object.freeze({ process });
}