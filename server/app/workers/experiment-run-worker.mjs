export function createExperimentRunWorker({ runService, executor, now = () => new Date() }) {
  if (!runService?.claim) throw new Error("runService.claim is required.");
  if (typeof executor !== "function") throw new Error("executor is required.");

  async function process({ runId, contextVersionId, input } = {}) {
    const claimed = runService.claim(runId, { contextVersionId, now: now() });
    if (!claimed) return null;
    try {
      const result = await executor({ run: claimed, input });
      return runService.complete(claimed.id, { contextVersionId, outcome: result });
    } catch (error) {
      return runService.fail(claimed.id, {
        contextVersionId,
        outcome: { executionError: { name: error?.name ?? "Error", message: error?.message ?? String(error) } },
      });
    }
  }

  return Object.freeze({ process });
}
