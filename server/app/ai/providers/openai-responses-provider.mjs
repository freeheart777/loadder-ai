import OpenAI from "openai";
import { AiProviderError, normalizeProviderError } from "../ai-provider-errors.mjs";
import { normalizeAiUsage } from "../ai-usage.mjs";

const refusalPresent = (response) => Array.isArray(response?.output) && response.output.some((item) => Array.isArray(item?.content) && item.content.some((content) => content?.type === "refusal" || typeof content?.refusal === "string"));

export function createOpenAiResponsesProvider({ apiKey = process.env.OPENAI_API_KEY, client = null, OpenAIClient = OpenAI } = {}) {
  let sharedClient = client;
  const configured = Boolean(apiKey || sharedClient);
  const getClient = () => {
    if (!configured) throw new AiProviderError("AI_PROVIDER_NOT_CONFIGURED");
    if (!sharedClient) sharedClient = new OpenAIClient({ apiKey });
    return sharedClient;
  };
  return Object.freeze({
    provider: "OPENAI",
    configured,
    async executeStructured({ operation, model, input, schema, schemaName, reasoningEffort, maxOutputTokens, timeoutMs }) {
      if (!operation || !model || !Array.isArray(input) || !schema || !schemaName || reasoningEffort !== "low" || !Number.isInteger(maxOutputTokens) || !Number.isInteger(timeoutMs)) throw new AiProviderError("AI_REQUEST_REJECTED");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await getClient().responses.create({
          model,
          reasoning: { effort: reasoningEffort },
          input,
          text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
          max_output_tokens: maxOutputTokens,
          store: false,
        }, { signal: controller.signal });
        if (refusalPresent(response)) throw new AiProviderError("AI_OUTPUT_INVALID");
        if (typeof response?.output_text !== "string" || !response.output_text.trim()) throw new AiProviderError("AI_PROVIDER_BAD_RESPONSE");
        let data;
        try { data = JSON.parse(response.output_text); }
        catch { throw new AiProviderError("AI_OUTPUT_INVALID"); }
        return Object.freeze({ data, usage: normalizeAiUsage(response.usage), provider: "OPENAI", model, providerRequestId: typeof response.id === "string" && response.id.length <= 120 ? response.id : null });
      } catch (error) {
        throw normalizeProviderError(error, controller.signal);
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
