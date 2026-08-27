export class ExperimentProviderError extends Error {
  constructor(message, status = 502, code = "EXPERIMENT_PROVIDER_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const requireText = (value, field) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ExperimentProviderError(`${field} is required.`, 400, "EXPERIMENT_PROVIDER_CONFIG_ERROR");
  }
  return value.trim();
};

export function createOpenAICompatibleProvider({
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  model,
  fetchImpl = globalThis.fetch,
  timeoutMs = 60_000,
} = {}) {
  const key = requireText(apiKey, "apiKey");
  const selectedModel = requireText(model, "model");
  if (typeof fetchImpl !== "function") throw new ExperimentProviderError("fetchImpl is required.", 500, "EXPERIMENT_PROVIDER_CONFIG_ERROR");
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  return async function execute({ plan, input = {} }) {
    const userInput = typeof input === "string" ? input : input.prompt;
    if (typeof userInput !== "string" || !userInput.trim()) {
      throw new ExperimentProviderError("input.prompt is required.", 400, "EXPERIMENT_PROVIDER_INPUT_ERROR");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: `Experiment objective: ${plan.objective}\nSuccess metric: ${plan.successMetric}\nTreatment: ${plan.treatmentDefinition}` },
            { role: "user", content: userInput.trim() },
          ],
        }),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ExperimentProviderError(body?.error?.message || `Provider request failed with status ${response.status}.`, response.status, "EXPERIMENT_PROVIDER_REQUEST_ERROR");
      }

      const choice = body?.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== "string") throw new ExperimentProviderError("Provider returned no message content.", 502, "EXPERIMENT_PROVIDER_RESPONSE_ERROR");

      return Object.freeze({
        provider: "openai-compatible",
        model: body.model ?? selectedModel,
        responseId: body.id ?? null,
        content,
        usage: body.usage ?? null,
      });
    } catch (error) {
      if (error instanceof ExperimentProviderError) throw error;
      if (error?.name === "AbortError") throw new ExperimentProviderError("Provider request timed out.", 504, "EXPERIMENT_PROVIDER_TIMEOUT");
      throw new ExperimentProviderError(error?.message ?? String(error));
    } finally {
      clearTimeout(timer);
    }
  };
}
