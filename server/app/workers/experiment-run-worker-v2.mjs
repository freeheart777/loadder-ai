export const createExperimentRunWorker = ({ runService, executor }) => {
  if (!runService?.claim) throw new Error("runService.claim is required.");
  if (typeof executor !== "function") throw new Error("executor is required.");
  return Object.freeze({
    async process({ runId, contextVersionId, input }) {
      const run = runService.claim(runId, { contextVersionId });
      if (!run) return null;
      try {
        const outcome = await executor({ run, input });
        return runService.complete(run.id, { contextVersionId, outcome });
      } catch (error) {
        return runService.fail(run.id, { contextVersionId, outcome: { executionError: { name: error?.name ?? "Error", message: error?.message ?? String(error) } } });
      }
    },
  });
};
