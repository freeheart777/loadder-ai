import { AiProviderError } from "../ai/ai-provider-errors.mjs";
import { createOpenAiResponsesProvider } from "../ai/providers/openai-responses-provider.mjs";

export class TextProviderError extends Error {
  constructor(code) { super("Text generation provider failed."); this.name = "TextProviderError"; this.code = code; }
}

const CONTENT_CODES = Object.freeze({ AI_PROVIDER_NOT_CONFIGURED: "CONTENT_PROVIDER_UNAVAILABLE", AI_PROVIDER_AUTH_FAILED: "CONTENT_PROVIDER_UNAVAILABLE", AI_PROVIDER_RATE_LIMITED: "CONTENT_GENERATION_FAILED", AI_PROVIDER_TIMEOUT: "CONTENT_PROVIDER_TIMEOUT", AI_PROVIDER_UNAVAILABLE: "CONTENT_GENERATION_FAILED", AI_PROVIDER_BAD_RESPONSE: "CONTENT_OUTPUT_INVALID", AI_OUTPUT_INVALID: "CONTENT_OUTPUT_INVALID", AI_REQUEST_REJECTED: "CONTENT_GENERATION_FAILED" });

export function createOpenAITextGenerationProvider({ apiKey = process.env.OPENAI_API_KEY, client = null, responsesProvider = null, economyService = null } = {}) {
  const provider = responsesProvider || createOpenAiResponsesProvider({ apiKey, client });
  return Object.freeze({
    async generateRegisteredContract({ binding, contract, template, workspaceId = null, userId = null }) {
      try {
        const request = {
          operation: "CONTENT_TEXT_GENERATION", model: binding.model, reasoningEffort: binding.reasoningEffort,
          input: [
            { role: "system", content: template.system },
            { role: "user", content: template.user },
          ],
          schema: contract.outputSchema, schemaName: `${contract.contractId}_v${contract.contractVersion}`,
          maxOutputTokens: Math.min(12_000, Math.max(1_500, Math.ceil(contract.maximumOutputCharacters / 2))), timeoutMs: binding.providerDeadlineMs,
        };
        const result = economyService ? await economyService.execute({ workspaceId, userId, operation: "CONTENT_TEXT_GENERATION", input: { contractId: contract.contractId, contractVersion: contract.contractVersion, templateVersion: contract.templateVersion, template }, providerInput: request.input, schema: request.schema, schemaName: request.schemaName }) : await provider.executeStructured(request);
        return Object.freeze({ output: result.data, usage: Object.freeze({ inputTokens: result.usage?.inputTokens || 0, outputTokens: result.usage?.outputTokens || 0 }) });
      } catch (error) {
        if (error instanceof TextProviderError) throw error;
        if (error instanceof AiProviderError) throw new TextProviderError(CONTENT_CODES[error.code] || "CONTENT_GENERATION_FAILED");
        throw new TextProviderError("CONTENT_GENERATION_FAILED");
      }
    },
  });
}
