export class ExperimentProviderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ExperimentProviderError";
    this.code = code;
    this.details = details;
  }
}

export function createExperimentProvider({ execute }) {
  if (typeof execute !== "function") {
    throw new TypeError("execute must be a function");
  }

  return Object.freeze({
    name: "experiment",
    version: "1.0",
    async execute(request) {
      if (!request || typeof request !== "object") {
        throw new ExperimentProviderError("INVALID_REQUEST", "request is required");
      }
      const result = await execute(Object.freeze({ ...request }));
      return Object.freeze({
        status: "completed",
        provider: "experiment",
        providerVersion: "1.0",
        result,
      });
    },
  });
}
