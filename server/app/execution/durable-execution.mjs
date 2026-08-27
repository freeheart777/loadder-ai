export class DurableExecutionError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "DurableExecutionError"; this.code = code; this.details = details; }
}

export function createDurableExecution({ store, provider, maxAttempts = 3, now = () => new Date().toISOString() }) {
  if (!store || typeof store.get !== "function" || typeof store.save !== "function") throw new TypeError("store must implement get/save");
  if (!provider || typeof provider.execute !== "function") throw new TypeError("provider must implement execute");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new TypeError("maxAttempts must be a positive integer");
  return Object.freeze({
    async run(request) {
      if (!request?.executionId) throw new DurableExecutionError("INVALID_EXECUTION", "executionId is required");
      const existing = await store.get(request.executionId);
      if (existing?.status === "completed") return existing;
      let attempt = existing?.status === "retryable" ? existing.attempt : 0;
      while (attempt < maxAttempts) {
        attempt += 1;
        const running = { executionId: request.executionId, status: "running", attempt, updatedAt: now() };
        await store.save(running);
        try {
          const result = await provider.execute(request);
          const completed = { ...running, status: "completed", result, updatedAt: now() };
          await store.save(completed); return completed;
        } catch (error) {
          const terminal = attempt >= maxAttempts;
          await store.save({ ...running, status: terminal ? "failed" : "retryable", error: { name: error?.name ?? "Error", code: error?.code ?? "PROVIDER_ERROR", message: error?.message ?? String(error) }, updatedAt: now() });
          if (terminal) throw new DurableExecutionError("EXECUTION_FAILED", "execution exhausted retries", { executionId: request.executionId, attempt });
        }
      }
      throw new DurableExecutionError("EXECUTION_FAILED", "execution could not complete");
    },
  });
}
