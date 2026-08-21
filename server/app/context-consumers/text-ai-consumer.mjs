export function createTextAiContextConsumer({ contextGateway }) {
  return Object.freeze({
    prepareInput({ operation = "prepare_context", executionRequestId = null, userId = null } = {}) {
      const result = contextGateway.consume({
        consumer: "text_ai",
        operation,
        executionRequestId,
        userId,
      });
      if (result.state !== "READY") return result;
      return {
        ...result,
        normalizedInput: {
          identity: result.context.identity,
          strategy: result.context.strategy,
          audiences: result.context.audiences,
          offerings: result.context.offerings,
          brand: result.context.brand,
          visual: result.context.visual,
        },
      };
    },
  });
}
